const { getWithRetry, toPositiveInt } = require("./http.js");
const logger = require("./logger.js");

function toBoolean(value, fallback) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
}

const ROBOTS_RESPECT = toBoolean(process.env.ROBOTS_RESPECT, true);
const ROBOTS_STRICT = toBoolean(process.env.ROBOTS_STRICT, false);
const ROBOTS_USER_AGENT = String(
  process.env.ROBOTS_USER_AGENT || "news-anime-monitor"
)
  .trim()
  .toLowerCase();
const ROBOTS_CACHE_TTL_MS = toPositiveInt(
  process.env.ROBOTS_CACHE_TTL_MS,
  6 * 60 * 60 * 1000
);
const ROBOTS_FAILURE_TTL_MS = toPositiveInt(
  process.env.ROBOTS_FAILURE_TTL_MS,
  15 * 60 * 1000
);
const ROBOTS_FETCH_ATTEMPTS = toPositiveInt(
  process.env.ROBOTS_FETCH_ATTEMPTS,
  2
);

const robotsCache = new Map();
const robotsPending = new Map();

function stripInlineComment(line) {
  const index = line.indexOf("#");
  return index >= 0 ? line.slice(0, index) : line;
}

function normalizeDirective(value) {
  return String(value || "").trim().toLowerCase();
}

function buildRuleRegex(pathPattern) {
  const hasEnd = pathPattern.endsWith("$");
  const basePattern = hasEnd ? pathPattern.slice(0, -1) : pathPattern;
  const escaped = basePattern
    .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*");

  const expression = `^${escaped}${hasEnd ? "$" : ""}`;
  return {
    regex: new RegExp(expression),
    matchLength: basePattern.length,
  };
}

function parseRobotsTxt(content) {
  const rulesByAgent = new Map();
  const lines = String(content || "").split(/\r?\n/);

  let currentAgents = [];
  let groupHasRules = false;

  function ensureAgent(agent) {
    if (!rulesByAgent.has(agent)) {
      rulesByAgent.set(agent, []);
    }
  }

  lines.forEach((rawLine) => {
    const line = stripInlineComment(rawLine).trim();
    if (!line) {
      currentAgents = [];
      groupHasRules = false;
      return;
    }

    const separatorIndex = line.indexOf(":");
    if (separatorIndex < 0) return;

    const directive = normalizeDirective(line.slice(0, separatorIndex));
    const value = String(line.slice(separatorIndex + 1) || "").trim();

    if (directive === "user-agent") {
      const agent = normalizeDirective(value) || "*";
      if (groupHasRules) {
        currentAgents = [agent];
        groupHasRules = false;
      } else {
        currentAgents.push(agent);
      }
      return;
    }

    if (!["allow", "disallow"].includes(directive)) {
      return;
    }

    if (!currentAgents.length) {
      currentAgents = ["*"];
    }

    if (!value) {
      // "Disallow:" vazio significa sem restricao.
      return;
    }

    const rule = {
      type: directive,
      path: value,
      ...buildRuleRegex(value),
    };

    currentAgents.forEach((agent) => {
      ensureAgent(agent);
      rulesByAgent.get(agent).push(rule);
    });

    groupHasRules = true;
  });

  return rulesByAgent;
}

function getApplicableAgentKey(rulesByAgent, userAgent) {
  const ua = normalizeDirective(userAgent) || ROBOTS_USER_AGENT;

  let bestKey = "";

  for (const agentKey of rulesByAgent.keys()) {
    if (agentKey === "*") continue;
    if (!ua.includes(agentKey)) continue;

    if (!bestKey || agentKey.length > bestKey.length) {
      bestKey = agentKey;
    }
  }

  if (bestKey) return bestKey;
  if (rulesByAgent.has("*")) return "*";
  return "";
}

function evaluatePathRules(pathWithQuery, rulesByAgent, userAgent) {
  const agentKey = getApplicableAgentKey(rulesByAgent, userAgent);
  const rules = agentKey ? rulesByAgent.get(agentKey) || [] : [];

  let matchedRule = null;

  rules.forEach((rule) => {
    if (!rule.regex.test(pathWithQuery)) return;

    if (!matchedRule) {
      matchedRule = rule;
      return;
    }

    if (rule.matchLength > matchedRule.matchLength) {
      matchedRule = rule;
      return;
    }

    if (
      rule.matchLength === matchedRule.matchLength &&
      rule.type === "allow" &&
      matchedRule.type === "disallow"
    ) {
      matchedRule = rule;
    }
  });

  if (!matchedRule) {
    return {
      allowed: true,
      matchedRule: null,
      agentKey,
    };
  }

  return {
    allowed: matchedRule.type === "allow",
    matchedRule,
    agentKey,
  };
}

function setCache(origin, payload, ttlMs) {
  robotsCache.set(origin, {
    expiresAt: Date.now() + ttlMs,
    ...payload,
  });
}

async function fetchRobotsRules(origin, options = {}) {
  const { headers, context } = options;
  const robotsUrl = `${origin}/robots.txt`;

  try {
    const response = await getWithRetry(robotsUrl, {
      context: `${context || "Robots"}/Fetch`,
      headers,
      maxAttempts: ROBOTS_FETCH_ATTEMPTS,
    });

    const rulesByAgent = parseRobotsTxt(response.data);
    const payload = {
      mode: "rules",
      rulesByAgent,
    };
    setCache(origin, payload, ROBOTS_CACHE_TTL_MS);
    return payload;
  } catch (error) {
    const status = error?.response?.status;
    const code = status || error?.code || "UNKNOWN";

    if (status === 404) {
      const payload = { mode: "allow_all_missing" };
      setCache(origin, payload, ROBOTS_CACHE_TTL_MS);
      return payload;
    }

    const allowByFallback = !ROBOTS_STRICT;
    logger.warn(
      `[${context || "Robots"}] Falha ao buscar robots.txt em ${robotsUrl} (${code}). Modo ${
        allowByFallback ? "permissivo" : "estrito"
      }.`
    );

    const payload = {
      mode: allowByFallback ? "allow_all_error" : "block_all_error",
      error,
    };

    setCache(origin, payload, ROBOTS_FAILURE_TTL_MS);
    return payload;
  }
}

async function getRobotsRules(origin, options = {}) {
  const cached = robotsCache.get(origin);
  if (cached && cached.expiresAt > Date.now()) {
    return cached;
  }

  if (robotsPending.has(origin)) {
    return robotsPending.get(origin);
  }

  const pending = fetchRobotsRules(origin, options).finally(() => {
    robotsPending.delete(origin);
  });

  robotsPending.set(origin, pending);
  return pending;
}

async function checkRobotsForUrl(rawUrl, options = {}) {
  const { headers, context = "Robots", userAgent = ROBOTS_USER_AGENT } = options;

  if (!ROBOTS_RESPECT) {
    return { allowed: true, reason: "robots_disabled" };
  }

  try {
    const url = new URL(rawUrl);
    const origin = url.origin;
    const pathWithQuery = `${url.pathname || "/"}${url.search || ""}`;

    const robotsState = await getRobotsRules(origin, {
      headers,
      context,
    });

    if (robotsState.mode === "allow_all_missing") {
      return { allowed: true, reason: "robots_missing" };
    }

    if (robotsState.mode === "allow_all_error") {
      return { allowed: true, reason: "robots_error_permissive" };
    }

    if (robotsState.mode === "block_all_error") {
      return { allowed: false, reason: "robots_error_strict" };
    }

    const decision = evaluatePathRules(
      pathWithQuery,
      robotsState.rulesByAgent || new Map(),
      userAgent
    );

    return {
      allowed: decision.allowed,
      reason: decision.allowed ? "robots_allowed" : "robots_disallowed",
      matchedRule: decision.matchedRule,
      agentKey: decision.agentKey,
    };
  } catch {
    return {
      allowed: !ROBOTS_STRICT,
      reason: ROBOTS_STRICT ? "invalid_url_strict" : "invalid_url_permissive",
    };
  }
}

module.exports = {
  checkRobotsForUrl,
};
