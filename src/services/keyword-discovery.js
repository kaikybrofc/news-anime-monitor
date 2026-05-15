const axios = require("axios");
const { normalizeHost } = require("../utils/url-normalization.js");

const SEARCH_ENGINE = "brave";
const BRAVE_ENDPOINT = "https://api.search.brave.com/res/v1/web/search";
const REQUEST_SPACING_MS = Math.max(0, Number(process.env.BRAVE_REQUEST_SPACING_MS || 1400));
const REQUEST_JITTER_MS = Math.max(0, Number(process.env.BRAVE_REQUEST_JITTER_MS || 350));
const MAX_SEARCH_ATTEMPTS = Math.max(1, Number(process.env.BRAVE_MAX_ATTEMPTS || 3));

const DEFAULT_KEYWORDS = [
  { query: "anime news", language: "en" },
  { query: "manga news", language: "en" },
  { query: "anime industry", language: "en" },
  { query: "anime blog", language: "en" },
  { query: "anime updates", language: "en" },
  { query: "anime rss", language: "en" },
  { query: "アニメ ニュース", language: "ja" },
  { query: "漫画 ニュース", language: "ja" },
  { query: "アニメ 新作", language: "ja" },
  { query: "アニメ 最新情報", language: "ja" },
];

const GENERIC_BLOCKLIST = new Set([
  "facebook.com",
  "twitter.com",
  "x.com",
  "instagram.com",
  "youtube.com",
  "youtu.be",
  "reddit.com",
  "wikipedia.org",
  "pinterest.com",
  "amazon.com",
  "github.com",
  "rss.com",
  "rss.feedspot.com",
  "feedspot.com",
  "medium.com",
  "blogspot.com",
  "wordpress.com",
  "tumblr.com",
  "quora.com",
]);

function unique(values = []) {
  return Array.from(new Set(values.filter(Boolean)));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function withJitter(baseMs) {
  const jitter = Math.floor(Math.random() * (REQUEST_JITTER_MS + 1));
  return Math.max(0, baseMs + jitter);
}

function containsBlockedDomain(domain = "") {
  const normalized = normalizeHost(domain);
  if (!normalized) return true;
  if (GENERIC_BLOCKLIST.has(normalized)) return true;
  return Array.from(GENERIC_BLOCKLIST).some(
    (blocked) => normalized === blocked || normalized.endsWith(`.${blocked}`)
  );
}

function buildDynamicKeywords(articles = [], maxKeywords = 6) {
  const names = articles
    .map((article) => String(article?.refined?.name || "").trim())
    .filter((name) => name.length >= 6)
    .slice(0, 60);

  const keywords = [];
  for (const name of names) {
    keywords.push({ query: `${name} anime news`, language: "en" });
    keywords.push({ query: `${name} anime updates`, language: "en" });
    if (keywords.length >= maxKeywords) break;
  }

  return keywords.slice(0, maxKeywords);
}

async function braveSearch(query, language = "en", count = 10) {
  const apiKey = String(process.env.BRAVE_SEARCH_API_KEY || "").trim();
  if (!apiKey) {
    return { ok: false, reason: "missing_api_key", items: [] };
  }

  let lastError = null;

  for (let attempt = 1; attempt <= MAX_SEARCH_ATTEMPTS; attempt += 1) {
    try {
      const response = await axios.get(BRAVE_ENDPOINT, {
        timeout: 15000,
        headers: {
          Accept: "application/json",
          "X-Subscription-Token": apiKey,
        },
        params: {
          q: query,
          count,
          search_lang: language,
        },
      });

      const results = Array.isArray(response?.data?.web?.results)
        ? response.data.web.results
        : [];

      return {
        ok: true,
        items: results.map((item, index) => ({
          position: index + 1,
          title: String(item.title || "").trim(),
          url: String(item.url || "").trim(),
          description: String(item.description || "").trim(),
        })),
      };
    } catch (error) {
      lastError = error;
      const status = Number(error?.response?.status || 0);
      const retryable = status === 429 || status >= 500 || !status;
      if (!retryable || attempt >= MAX_SEARCH_ATTEMPTS) {
        break;
      }
      const backoffMs = withJitter(1200 * 2 ** (attempt - 1));
      await sleep(backoffMs);
    }
  }

  return {
    ok: false,
    reason: lastError?.message || "search_failed",
    items: [],
  };
}

function toCandidateRow(result, knownDomains = new Set(), query = "", language = "en") {
  try {
    const parsed = new URL(String(result.url || ""));
    if (!["http:", "https:"].includes(parsed.protocol)) return null;

    const domain = normalizeHost(parsed.hostname);
    if (!domain || containsBlockedDomain(domain) || knownDomains.has(domain)) {
      return null;
    }

    return {
      domain,
      topicConfidence: 0.45,
      referenceCount: 1,
      uniqueArticles: 1,
      firstSeenAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString(),
      sampleUrls: [parsed.toString()],
      discoveredBy: "keyword_search",
      keyword: query,
      language,
      searchEngine: SEARCH_ENGINE,
      position: result.position,
    };
  } catch {
    return null;
  }
}

async function runKeywordDiscovery(options = {}) {
  const {
    articles = [],
    knownDomains = new Set(),
    topPerQuery = 10,
    manualKeywords = DEFAULT_KEYWORDS,
    maxDynamicKeywords = 6,
  } = options;

  const dynamicKeywords = buildDynamicKeywords(articles, maxDynamicKeywords);
  const keywordJobs = [...manualKeywords, ...dynamicKeywords];
  const aggregatedCandidates = new Map();
  const jobSummaries = [];

  for (const job of keywordJobs) {
    const query = String(job.query || "").trim();
    const language = String(job.language || "en").trim() || "en";
    if (!query) continue;

    const search = await braveSearch(query, language, topPerQuery);
    const results = Array.isArray(search.items) ? search.items : [];

    let newCandidates = 0;
    for (const result of results) {
      const candidate = toCandidateRow(result, knownDomains, query, language);
      if (!candidate) continue;

      const existing = aggregatedCandidates.get(candidate.domain);
      if (existing) {
        existing.topicConfidence = Math.min(1, Math.max(existing.topicConfidence, candidate.topicConfidence));
        existing.referenceCount += 1;
        existing.sampleUrls = unique([...existing.sampleUrls, ...candidate.sampleUrls]).slice(0, 5);
        if (candidate.position < existing.position) {
          existing.position = candidate.position;
          existing.keyword = candidate.keyword;
          existing.language = candidate.language;
        }
        continue;
      }

      aggregatedCandidates.set(candidate.domain, candidate);
      newCandidates += 1;
    }

    jobSummaries.push({
      query,
      language,
      searchEngine: SEARCH_ENGINE,
      lastRunAt: new Date().toISOString(),
      domainsFound: results.length,
      newCandidates,
      results: results.slice(0, 20),
      ok: Boolean(search.ok),
      reason: search.reason || "",
    });

    // Keep a stable pace to reduce API rate-limit responses.
    await sleep(withJitter(REQUEST_SPACING_MS));
  }

  return {
    jobs: jobSummaries,
    candidates: Array.from(aggregatedCandidates.values()).sort((a, b) => {
      if (a.position !== b.position) return a.position - b.position;
      return a.domain.localeCompare(b.domain);
    }),
  };
}

module.exports = {
  runKeywordDiscovery,
};
