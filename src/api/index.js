const express = require("express");
const cors = require("cors");
const fs = require("fs");
const helmet = require("helmet");
const path = require("path");
const rateLimit = require("express-rate-limit");
const crypto = require("crypto");
const logger = require("../utils/logger.js");
const { toPositiveInt } = require("../utils/http.js");
const {
  getNewsSources,
  SOURCE_DEFINITIONS,
} = require("../config/news-sources.js");
const {
  processArticleCandidate,
  processWithConcurrency,
} = require("../services/article-processor.js");
const {
  createSourceMetricsTracker,
  applyTopicTrendScores,
  buildInventoryMetrics,
} = require("../services/monitor-analytics.js");
const {
  createObservabilityTracker,
} = require("../services/observability-alerts.js");

const { collectItemsFromSource } = require("../pipeline/ingestion.js");
const { normalizeCollectedItems } = require("../pipeline/normalization.js");
const { filterItemsBySource } = require("../pipeline/filtering.js");
const {
  dedupeCandidates,
  buildExistingArticleIndex,
  matchCandidateToExisting,
  indexArticle,
} = require("../pipeline/dedupe.js");
const {
  applyArticleDefaults,
  bumpArticleSeen,
} = require("../pipeline/enrichment.js");
const {
  createSourceMetrics,
  finishSourceMetrics,
  createCycleMetrics,
  finishCycleMetrics,
} = require("../pipeline/metrics.js");
const {
  ensureDatabaseAndTable,
  findMatchingArticle,
  loadArticleById,
  loadAllArticles,
  queryArticles,
  queryFranchiseSummary,
  querySourceSummary,
  queryTrendSnapshot,
  saveAllArticlesSnapshot,
} = require("../db/articles-repository.js");
const { hasDbConfig } = require("../db/mysql.js");

function parseCommaSeparatedList(value = "") {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function toPositiveNumber(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

// --- CONFIGURAÇÃO ---
const NEWS_SOURCES = getNewsSources();
const DAYS_BACK = toPositiveInt(process.env.DAYS_BACK, 3);
const MAX_ITEMS_PER_SOURCE = toPositiveInt(
  process.env.MAX_ITEMS_PER_SOURCE || process.env.MAX_ITEMS,
  50
);
const MAX_SITEMAPS_PER_SOURCE = toPositiveInt(
  process.env.MAX_SITEMAPS_PER_SOURCE || process.env.MAX_SITEMAPS,
  5
);
const MAX_NEW_ARTICLES_PER_CYCLE = toPositiveInt(
  process.env.MAX_NEW_ARTICLES_PER_CYCLE,
  MAX_ITEMS_PER_SOURCE * Math.max(1, NEWS_SOURCES.length)
);
const CHECK_INTERVAL_MS = toPositiveInt(process.env.CHECK_INTERVAL_MS, 900000);
const EXPIRATION_TIME_MS = toPositiveInt(
  process.env.EXPIRATION_TIME_MS,
  24 * 60 * 60 * 1000
);
const CLEANUP_INTERVAL_MS = toPositiveInt(
  process.env.CLEANUP_INTERVAL_MS,
  60 * 60 * 1000
);
const ARTICLE_PROCESS_CONCURRENCY = toPositiveInt(
  process.env.ARTICLE_PROCESS_CONCURRENCY,
  1
);
const IN_MEMORY_MAX_ARTICLES = toPositiveInt(
  process.env.IN_MEMORY_MAX_ARTICLES,
  0
);
const API_DEFAULT_LIMIT = toPositiveInt(process.env.API_DEFAULT_LIMIT, 50);
const API_MAX_LIMIT = toPositiveInt(process.env.API_MAX_LIMIT, 200);
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || "127.0.0.1";
const USE_MYSQL = hasDbConfig();
const CORS_ALLOWED_ORIGINS = parseCommaSeparatedList(
  process.env.CORS_ALLOWED_ORIGINS ||
    "https://omnizap.xyz,https://www.omnizap.xyz,http://localhost:3010,http://127.0.0.1:3010"
);
const RATE_LIMIT_WINDOW_MS = toPositiveInt(
  process.env.RATE_LIMIT_WINDOW_MS,
  60 * 1000
);
const RATE_LIMIT_MAX = toPositiveInt(process.env.RATE_LIMIT_MAX, 180);
const DEBUG_RATE_LIMIT_MAX = toPositiveInt(process.env.DEBUG_RATE_LIMIT_MAX, 30);
const DEBUG_SOURCES_TOKEN = String(process.env.DEBUG_SOURCES_TOKEN || "").trim();
const ALERT_HISTORY_SIZE = toPositiveInt(process.env.ALERT_HISTORY_SIZE, 72);
const ALERT_BASELINE_WINDOW = toPositiveInt(process.env.ALERT_BASELINE_WINDOW, 12);
const ALERT_FETCH_DROP_WARNING_RATIO = toPositiveNumber(
  process.env.ALERT_FETCH_DROP_WARNING_RATIO,
  0.55
);
const ALERT_FETCH_DROP_CRITICAL_RATIO = toPositiveNumber(
  process.env.ALERT_FETCH_DROP_CRITICAL_RATIO,
  0.3
);
const ALERT_ACCEPTED_DROP_WARNING_RATIO = toPositiveNumber(
  process.env.ALERT_ACCEPTED_DROP_WARNING_RATIO,
  0.55
);
const ALERT_ACCEPTED_DROP_CRITICAL_RATIO = toPositiveNumber(
  process.env.ALERT_ACCEPTED_DROP_CRITICAL_RATIO,
  0.3
);
const ALERT_PARSE_ERROR_WARNING_RATE = toPositiveNumber(
  process.env.ALERT_PARSE_ERROR_WARNING_RATE,
  0.1
);
const ALERT_PARSE_ERROR_CRITICAL_RATE = toPositiveNumber(
  process.env.ALERT_PARSE_ERROR_CRITICAL_RATE,
  0.3
);
const ALERT_REJECT_SPIKE_MULTIPLIER = toPositiveNumber(
  process.env.ALERT_REJECT_SPIKE_MULTIPLIER,
  2
);
const ALERT_REJECT_SPIKE_MIN_DELTA = toPositiveNumber(
  process.env.ALERT_REJECT_SPIKE_MIN_DELTA,
  0.2
);
const ALERT_DURATION_SPIKE_MULTIPLIER = toPositiveNumber(
  process.env.ALERT_DURATION_SPIKE_MULTIPLIER,
  2
);
const ALERT_DURATION_SPIKE_MIN_MS = toPositiveInt(
  process.env.ALERT_DURATION_SPIKE_MIN_MS,
  2000
);
const DATA_FILE = path.resolve(
  __dirname,
  "..",
  "data",
  "processed_articles.json"
);
// --- FIM DA CONFIGURAÇÃO ---

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1);

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);

const corsMiddleware = cors({
  origin(origin, callback) {
    if (!origin) {
      callback(null, true);
      return;
    }

    if (CORS_ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error("Origin não permitida."));
  },
  methods: ["GET", "HEAD", "OPTIONS"],
  credentials: false,
  maxAge: 60 * 60 * 24,
});

app.use((req, res, next) => {
  corsMiddleware(req, res, (error) => {
    if (error) {
      return res.status(403).json({
        error: "Origin não permitida.",
      });
    }

    return next();
  });
});

app.options(/.*/, corsMiddleware);

const apiRateLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Muitas requisições. Tente novamente em instantes.",
  },
});

const debugRateLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: DEBUG_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Muitas requisições ao endpoint de debug.",
  },
});

app.use(apiRateLimiter);

const knownArticleUrls = new Set();
let processedArticles = [];
let isCheckingNews = false;
let isShuttingDown = false;
let lastCycleMetrics = null;
let lastSourceMetrics = [];
const observabilityTracker = createObservabilityTracker(NEWS_SOURCES, {
  historySize: ALERT_HISTORY_SIZE,
  baselineWindow: ALERT_BASELINE_WINDOW,
  fetchedDropWarningRatio: ALERT_FETCH_DROP_WARNING_RATIO,
  fetchedDropCriticalRatio: ALERT_FETCH_DROP_CRITICAL_RATIO,
  acceptedDropWarningRatio: ALERT_ACCEPTED_DROP_WARNING_RATIO,
  acceptedDropCriticalRatio: ALERT_ACCEPTED_DROP_CRITICAL_RATIO,
  parseErrorWarningRate: ALERT_PARSE_ERROR_WARNING_RATE,
  parseErrorCriticalRate: ALERT_PARSE_ERROR_CRITICAL_RATE,
  rejectSpikeMultiplier: ALERT_REJECT_SPIKE_MULTIPLIER,
  rejectSpikeMinDelta: ALERT_REJECT_SPIKE_MIN_DELTA,
  durationSpikeMultiplier: ALERT_DURATION_SPIKE_MULTIPLIER,
  durationSpikeMinMs: ALERT_DURATION_SPIKE_MIN_MS,
});

function normalizeIp(value = "") {
  const text = String(value || "").trim();
  if (!text) return "";

  const first = text.split(",")[0].trim();
  if (!first) return "";

  if (first.startsWith("::ffff:")) {
    return first.slice("::ffff:".length);
  }

  return first;
}

function isLoopbackIp(value = "") {
  const ip = normalizeIp(value);
  return ip === "127.0.0.1" || ip === "::1" || ip === "localhost";
}

function getRequestToken(req) {
  const headerToken = String(req.get("x-debug-token") || "").trim();
  if (headerToken) return headerToken;

  const authHeader = String(req.get("authorization") || "").trim();
  if (authHeader.toLowerCase().startsWith("bearer ")) {
    return authHeader.slice(7).trim();
  }

  return String(req.query.token || "").trim();
}

function safeTokenMatch(providedToken = "", expectedToken = "") {
  const provided = String(providedToken || "").trim();
  const expected = String(expectedToken || "").trim();
  if (!provided || !expected) return false;

  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);

  if (providedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(providedBuffer, expectedBuffer);
}

function isLocalDebugRequest(req) {
  const forwardedIp = normalizeIp(req.get("x-forwarded-for"));
  if (forwardedIp) {
    return isLoopbackIp(forwardedIp);
  }

  return (
    isLoopbackIp(req.socket?.remoteAddress) ||
    isLoopbackIp(req.connection?.remoteAddress)
  );
}

function requireDebugAccess(req, res, next) {
  if (isLocalDebugRequest(req)) {
    return next();
  }

  const token = getRequestToken(req);
  if (DEBUG_SOURCES_TOKEN && safeTokenMatch(token, DEBUG_SOURCES_TOKEN)) {
    return next();
  }

  return res.status(403).json({
    error:
      "Acesso negado ao endpoint de debug. Use localhost ou um token válido em x-debug-token.",
  });
}

let previousAlertKeys = new Set();

function buildAlertKey(alert = {}) {
  return [
    String(alert.source || ""),
    String(alert.code || ""),
    String(alert.severity || ""),
  ].join("|");
}

function emitObservabilityAlerts(snapshot = {}) {
  const alerts = Array.isArray(snapshot.activeAlerts)
    ? snapshot.activeAlerts
    : [];
  const currentKeys = new Set(alerts.map((alert) => buildAlertKey(alert)));

  alerts.forEach((alert) => {
    const key = buildAlertKey(alert);
    if (previousAlertKeys.has(key)) return;

    const line = `[Alert][${alert.severity || "warning"}][${alert.source || "source"}] ${
      alert.code || "unknown"
    }: ${alert.message || ""}`;

    if (alert.severity === "critical") {
      logger.error(line);
      return;
    }

    logger.warn(line);
  });

  previousAlertKeys.forEach((key) => {
    if (currentKeys.has(key)) return;
    logger.success(`[Alert][resolved] ${key}`);
  });

  previousAlertKeys = currentKeys;
}

function rebuildKnownArticleUrls() {
  knownArticleUrls.clear();
  processedArticles.forEach((article) => {
    const url = article?.refined?.canonicalUrl || article?.refined?.url;
    if (url) knownArticleUrls.add(url);
  });
}

function enforceInMemoryWindow() {
  if (!IN_MEMORY_MAX_ARTICLES) return;

  processedArticles = processedArticles
    .slice()
    .sort((a, b) => getItemTimestamp(b) - getItemTimestamp(a))
    .slice(0, IN_MEMORY_MAX_ARTICLES);
}

function getItemTimestamp(item) {
  const refined = item?.refined || {};
  const dateValue =
    refined.publishedAt ||
    item?.publishedAt ||
    item?.pubDate ||
    item?.lastmod ||
    refined.firstSeenAt ||
    item?.firstSeenAt ||
    item?.timestamp ||
    refined.lastSeenAt;
  if (!dateValue) return 0;

  const parsed = Date.parse(dateValue);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function replaceArticle(oldArticle, updatedArticle) {
  const index = processedArticles.findIndex(
    (article) => article === oldArticle || article.id === oldArticle.id
  );

  if (index >= 0) {
    processedArticles[index] = updatedArticle;
    return;
  }

  processedArticles.unshift(updatedArticle);
}

function upsertArticleInMemory(article) {
  const index = processedArticles.findIndex((item) => item.id === article.id);
  if (index >= 0) {
    processedArticles[index] = article;
    return;
  }

  processedArticles.unshift(article);
}

function markExistingArticleSeen(existingArticle, candidate, reason, seenAt, indexes) {
  const updated = bumpArticleSeen(existingArticle, candidate, reason, seenAt);
  replaceArticle(existingArticle, updated);
  indexArticle(indexes, updated);

  const canonical = updated?.refined?.canonicalUrl || updated?.refined?.url;
  if (canonical) knownArticleUrls.add(canonical);

  return {
    article: updated,
    eventType: String(updated?.refined?.lastSeenEvent || "revisited"),
  };
}

async function matchCandidateWithStorageFallback(candidate, indexes, options = {}) {
  const memoryMatch = matchCandidateToExisting(candidate, indexes, options);
  if (memoryMatch) {
    return memoryMatch;
  }

  if (!USE_MYSQL) {
    return null;
  }

  const storageMatch = await findMatchingArticle(candidate, options);
  if (!storageMatch?.article) {
    return null;
  }

  const hydrated = applyArticleDefaults(storageMatch.article);
  upsertArticleInMemory(hydrated);
  indexArticle(indexes, hydrated);

  return {
    article: hydrated,
    reason: storageMatch.reason || "storage",
  };
}

function loadArticlesFromJsonFile() {
  if (!fs.existsSync(DATA_FILE)) {
    return [];
  }

  const data = fs.readFileSync(DATA_FILE, "utf8");
  const parsed = JSON.parse(data);
  if (!Array.isArray(parsed)) {
    throw new Error("Formato inválido de cache JSON: esperado um array.");
  }

  return parsed.filter((article) => article?.refined?.url);
}

function saveArticlesToJsonFile(articles) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(articles, null, 2), "utf8");
}

function parseQueryDate(value) {
  const parsed = Date.parse(String(value || "").trim());
  if (Number.isNaN(parsed)) return "";
  return new Date(parsed).toISOString();
}

function normalizeQueryText(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeSearchText(value) {
  return normalizeToAscii(String(value || "")).toLowerCase().trim();
}

function articleMatchesTextQuery(article, queryText = "") {
  const normalizedQuery = normalizeSearchText(queryText);
  if (!normalizedQuery) {
    return true;
  }

  const refined = article?.refined || {};
  const entities = refined.entities || {};
  const searchTokens = normalizedQuery
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 8);

  if (!searchTokens.length) {
    return true;
  }

  const searchableParts = [
    refined.name,
    article?.name,
    refined.titleNormalized,
    refined.summary,
    refined.sourceName,
    refined.sourceId,
    refined.bucket,
    refined.contentType,
    refined.lastSeenEvent,
    refined.canonicalUrl,
    refined.url,
    article?.id,
  ];

  if (Array.isArray(refined.categories)) {
    searchableParts.push(refined.categories.join(" "));
  }
  if (Array.isArray(refined.categoriesNormalized)) {
    searchableParts.push(refined.categoriesNormalized.join(" "));
  }
  if (Array.isArray(entities.anime)) {
    searchableParts.push(
      entities.anime
        .map((item) => `${item?.name || ""} ${item?.slug || ""}`.trim())
        .join(" ")
    );
  }
  if (Array.isArray(entities.characters)) {
    searchableParts.push(
      entities.characters
        .map((item) => `${item?.name || ""} ${item?.slug || ""}`.trim())
        .join(" ")
    );
  }
  if (Array.isArray(entities.studios)) {
    searchableParts.push(
      entities.studios
        .map((item) => `${item?.name || ""} ${item?.slug || ""}`.trim())
        .join(" ")
    );
  }
  if (Array.isArray(entities.tags)) {
    searchableParts.push(
      entities.tags
        .map((item) => `${item?.name || ""} ${item?.slug || ""}`.trim())
        .join(" ")
    );
  }

  const haystack = normalizeSearchText(searchableParts.join(" "));
  return searchTokens.every((token) => haystack.includes(token));
}

function normalizeToAscii(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function slugifyNewsText(value = "", maxLength = 84) {
  const cleaned = normalizeToAscii(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-")
    .trim();

  if (!cleaned) return "noticia";
  if (cleaned.length <= maxLength) return cleaned;

  return cleaned.slice(0, maxLength).replace(/-+$/g, "");
}

function formatNewsDateSlug(value) {
  const parsed = Date.parse(String(value || ""));
  if (Number.isNaN(parsed)) return "sem-data";

  const date = new Date(parsed);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getArticleTitleForSlug(article = {}) {
  const refined = article?.refined || {};
  const explicitTitle = String(refined.name || article.name || "").trim();
  if (explicitTitle) return explicitTitle;

  const normalizedTitle = String(refined.titleNormalized || "").trim();
  if (normalizedTitle) return normalizedTitle;

  return String(refined.canonicalUrl || refined.url || article.id || "noticia");
}

function getArticlePublishedAtForSlug(article = {}) {
  const refined = article?.refined || {};
  return refined.publishedAt || article.publishedAt || article.timestamp || "";
}

function buildArticleNewsSlug(article = {}) {
  const titleSlug = slugifyNewsText(getArticleTitleForSlug(article), 84);
  const dateSlug = formatNewsDateSlug(getArticlePublishedAtForSlug(article));
  return `${titleSlug}-${dateSlug}`;
}

function normalizeLimit(value, fallback = API_DEFAULT_LIMIT) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(API_MAX_LIMIT, Math.floor(parsed));
}

function normalizeOffset(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.floor(parsed);
}

function filterArticlesInMemory(articles, filters) {
  return articles.filter((article) => {
    const refined = article?.refined || {};

    if (filters.q && !articleMatchesTextQuery(article, filters.q)) {
      return false;
    }

    if (filters.sourceId && normalizeQueryText(refined.sourceId) !== filters.sourceId) {
      return false;
    }

    if (filters.bucket && normalizeQueryText(refined.bucket) !== filters.bucket) {
      return false;
    }

    if (
      filters.contentType &&
      normalizeQueryText(refined.contentType) !== filters.contentType
    ) {
      return false;
    }

    if (
      filters.lastSeenEvent &&
      normalizeQueryText(refined.lastSeenEvent) !== filters.lastSeenEvent
    ) {
      return false;
    }

    const timestamp = Date.parse(refined.lastSeenAt || article.timestamp || "");
    if (filters.from && (!timestamp || timestamp < Date.parse(filters.from))) {
      return false;
    }
    if (filters.to && (!timestamp || timestamp > Date.parse(filters.to))) {
      return false;
    }

    return true;
  });
}

async function getArticlePage(filters = {}, pagination = {}) {
  const limit = normalizeLimit(pagination.limit, API_DEFAULT_LIMIT);
  const offset = normalizeOffset(pagination.offset);

  if (USE_MYSQL) {
    const result = await queryArticles({
      limit,
      offset,
      q: filters.q,
      sourceId: filters.sourceId,
      bucket: filters.bucket,
      contentType: filters.contentType,
      lastSeenEvent: filters.lastSeenEvent,
      from: filters.from,
      to: filters.to,
    });

    return {
      ...result,
      items: result.items.map((item) => applyArticleDefaults(item)),
    };
  }

  const filtered = filterArticlesInMemory(processedArticles, filters).sort(
    (a, b) => {
      if (filters.q) {
        const scoreDiff =
          Number(b?.refined?.score || 0) - Number(a?.refined?.score || 0);
        if (scoreDiff !== 0) return scoreDiff;
      }

      return getItemTimestamp(b) - getItemTimestamp(a);
    }
  );
  const items = filtered.slice(offset, offset + limit);
  return {
    total: filtered.length,
    limit,
    offset,
    hasMore: offset + items.length < filtered.length,
    items,
  };
}

const FRANCHISE_STOPWORDS = new Set([
  "anime",
  "news",
  "trailer",
  "teaser",
  "visual",
  "announces",
  "announce",
  "reveals",
  "reveal",
  "update",
  "updates",
  "official",
  "episode",
  "season",
  "movie",
  "film",
  "tv",
  "daily",
  "brief",
  "briefs",
  "new",
]);

const SEO_ENTITY_TYPES = new Set(["anime", "character", "studio", "tag"]);

const STUDIO_MATCHERS = [
  { slug: "mappa", name: "MAPPA", pattern: /\bmappa\b/i },
  { slug: "toei-animation", name: "Toei Animation", pattern: /\btoei\b|\btoei animation\b/i },
  { slug: "a-1-pictures", name: "A-1 Pictures", pattern: /\ba-1 pictures\b|\ba1 pictures\b/i },
  { slug: "wit-studio", name: "Wit Studio", pattern: /\bwit studio\b/i },
  { slug: "bones", name: "Bones", pattern: /\bbones\b/i },
  { slug: "ufotable", name: "ufotable", pattern: /\bufotable\b/i },
  { slug: "trigger", name: "Trigger", pattern: /\btrigger\b/i },
  { slug: "madhouse", name: "Madhouse", pattern: /\bmadhouse\b/i },
  { slug: "cloverworks", name: "CloverWorks", pattern: /\bcloverworks\b/i },
  { slug: "pierrot", name: "Pierrot", pattern: /\bpierrot\b/i },
  { slug: "production-i-g", name: "Production I.G", pattern: /\bproduction i\.?g\b/i },
  { slug: "kyoto-animation", name: "Kyoto Animation", pattern: /\bkyoto animation\b|\bkyoani\b/i },
  { slug: "studio-ghibli", name: "Studio Ghibli", pattern: /\bstudio ghibli\b|\bghibli\b/i },
  { slug: "sunrise", name: "Sunrise", pattern: /\bsunrise\b/i },
];

const CHARACTER_HINT_PATTERN =
  /\b(character|cast|voice|seiyuu|portrays|joins|reveals|introduces|debut|live-action)\b/i;

const CHARACTER_SLUG_BLOCKLIST = new Set([
  "anime",
  "animation",
  "announcement",
  "cast",
  "daily-brief",
  "daily-briefs",
  "episode",
  "film",
  "japanese-animation",
  "live-action",
  "movie",
  "news",
  "official",
  "ranking",
  "season",
  "series",
  "song",
  "teaser",
  "trailer",
  "tv-ranking",
  "visual",
]);

const CHARACTER_TOKEN_BLOCKLIST = new Set([
  "action",
  "anime",
  "april",
  "cast",
  "chapter",
  "episode",
  "game",
  "live",
  "main",
  "movie",
  "news",
  "official",
  "reveals",
  "season",
  "series",
  "song",
  "story",
  "teaser",
  "trailer",
  "video",
  "voice",
]);

function slugToName(slug) {
  return String(slug || "")
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function tokenizeFranchise(value = "") {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 && !FRANCHISE_STOPWORDS.has(token));
}

function deriveFranchiseFromRefined(refined = {}) {
  const explicitSlug = String(refined.franchiseSlug || "").trim().toLowerCase();
  if (explicitSlug) {
    return {
      slug: explicitSlug,
      name: String(refined.franchiseName || slugToName(explicitSlug)),
    };
  }

  const clusterHint = String(refined.clusterHint || "");
  if (clusterHint) {
    const parts = clusterHint.split("|");
    const franchiseToken = String(parts[2] || "").trim().toLowerCase();
    if (franchiseToken && franchiseToken !== "na") {
      return {
        slug: franchiseToken,
        name: slugToName(franchiseToken),
      };
    }
  }

  const topicKey = String(refined.topicKey || "");
  if (topicKey) {
    const parts = topicKey.split("|");
    const topicToken = String(parts[1] || "").trim().toLowerCase();
    if (topicToken && topicToken !== "na") {
      return {
        slug: topicToken,
        name: slugToName(topicToken),
      };
    }
  }

  const titleTokens = tokenizeFranchise(refined.titleNormalized || refined.name || "");
  if (titleTokens.length) {
    const slug = titleTokens.slice(0, 3).join("-");
    return {
      slug,
      name: slugToName(slug),
    };
  }

  return { slug: "", name: "" };
}

function ensureStringArray(value) {
  if (Array.isArray(value)) {
    return value
      .map((entry) => String(entry || "").trim())
      .filter(Boolean);
  }

  const text = String(value || "").trim();
  return text ? [text] : [];
}

function toEntityDisplayName(value = "") {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text) return "";

  return text
    .split(" ")
    .map((part) => {
      if (!part) return "";
      if (part === part.toUpperCase()) return part;
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join(" ");
}

function dedupeEntities(entities = []) {
  const bySlug = new Map();

  for (const entity of entities) {
    const slug = normalizeQueryText(entity?.slug);
    if (!slug || bySlug.has(slug)) {
      continue;
    }

    bySlug.set(slug, {
      slug,
      name: String(entity?.name || slugToName(slug)),
    });
  }

  return Array.from(bySlug.values());
}

function buildAnimeEntities(article = {}) {
  const refined = article?.refined || {};
  let franchise = { slug: "", name: "" };

  const explicitSlug = normalizeQueryText(refined.franchiseSlug);
  if (explicitSlug) {
    franchise = {
      slug: explicitSlug,
      name: String(refined.franchiseName || slugToName(explicitSlug)),
    };
  } else {
    const clusterHint = String(refined.clusterHint || "");
    if (clusterHint) {
      const clusterParts = clusterHint.split("|");
      const clusterToken = normalizeQueryText(clusterParts[2]);
      if (clusterToken && clusterToken !== "na") {
        franchise = {
          slug: clusterToken,
          name: slugToName(clusterToken),
        };
      }
    }
  }

  if (!franchise.slug) {
    const topicKey = String(refined.topicKey || "");
    if (topicKey) {
      const topicParts = topicKey.split("|");
      const topicToken = normalizeQueryText(topicParts[1]);
      if (topicToken && topicToken !== "na") {
        franchise = {
          slug: topicToken,
          name: slugToName(topicToken),
        };
      }
    }
  }

  if (!franchise.slug) {
    return [];
  }

  return [
    {
      slug: normalizeQueryText(franchise.slug),
      name: String(franchise.name || slugToName(franchise.slug)),
    },
  ];
}

function buildTagEntities(article = {}) {
  const refined = article?.refined || {};
  const tags = [];

  const rawCategories = [
    ...ensureStringArray(refined.categoriesNormalized),
    ...ensureStringArray(refined.categories),
  ];

  for (const category of rawCategories) {
    const normalized = normalizeQueryText(category)
      .replace(/[_/]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!normalized) continue;

    const slug = slugifyNewsText(normalized, 64);
    if (!slug) continue;

    tags.push({
      slug,
      name: toEntityDisplayName(normalized),
    });
  }

  const contentType = normalizeQueryText(refined.contentType);
  if (contentType && contentType !== "unknown") {
    tags.push({
      slug: slugifyNewsText(contentType, 64),
      name: toEntityDisplayName(contentType),
    });
  }

  const topicParts = String(refined.topicKey || "")
    .split("|")
    .map((part) => normalizeQueryText(part))
    .filter(Boolean);
  if (topicParts[1] && topicParts[1] !== "na") {
    const topicTag = topicParts[1].replace(/-/g, " ");
    tags.push({
      slug: slugifyNewsText(topicTag, 64),
      name: toEntityDisplayName(topicTag),
    });
  }

  return dedupeEntities(tags);
}

function buildStudioEntities(article = {}) {
  const refined = article?.refined || {};
  const contextText = `${refined.name || article.name || ""} ${
    refined.summary || ""
  }`;

  if (!String(contextText).trim()) {
    return [];
  }

  const studios = STUDIO_MATCHERS.filter((studio) => studio.pattern.test(contextText)).map(
    (studio) => ({
      slug: studio.slug,
      name: studio.name,
    })
  );

  return dedupeEntities(studios);
}

function cleanCharacterCandidate(value = "") {
  const cleaned = String(value || "")
    .replace(/[“”]/g, '"')
    .replace(/[’]/g, "'")
    .replace(/\s+/g, " ")
    .trim();

  return cleaned
    .replace(/\b(Series|Season|Trailer|Teaser|Visual|Song|News|Anime|Movie|Film|Episode)\b$/i, "")
    .trim();
}

function isLikelyCharacterName(value = "") {
  const text = String(value || "").trim();
  if (!text) return false;

  const tokens = text
    .toLowerCase()
    .split(/\s+/)
    .map((token) => token.replace(/[^a-z0-9'-]/g, ""))
    .filter(Boolean);
  if (!tokens.length || tokens.length > 3) return false;
  if (tokens.some((token) => CHARACTER_TOKEN_BLOCKLIST.has(token))) return false;

  return true;
}

function buildCharacterEntities(article = {}) {
  const refined = article?.refined || {};
  const rawTitle = String(refined.name || article.name || "").trim();
  const rawSummary = String(refined.summary || "").trim();
  const contextText = `${rawTitle} ${rawSummary}`.trim();

  if (!rawTitle || !CHARACTER_HINT_PATTERN.test(contextText)) {
    return [];
  }

  const animeEntities = buildAnimeEntities(article);
  const animeSlugs = new Set(animeEntities.map((item) => item.slug));
  const candidates = [];

  const revealPattern =
    /\b(?:reveals?|introduces?|features?|starring|joins?|portrays)\s+([A-Z][A-Za-z0-9'’-]{2,}(?:\s+[A-Z][A-Za-z0-9'’-]{2,})?)/g;
  for (const match of rawTitle.matchAll(revealPattern)) {
    const candidate = cleanCharacterCandidate(match[1]);
    if (candidate && isLikelyCharacterName(candidate)) {
      candidates.push(candidate);
    }
  }

  const asPattern =
    /\b(?:as|character)\s+([A-Z][A-Za-z0-9'’-]{2,}(?:\s+[A-Z][A-Za-z0-9'’-]{2,})?)/g;
  for (const match of rawTitle.matchAll(asPattern)) {
    const candidate = cleanCharacterCandidate(match[1]);
    if (candidate && isLikelyCharacterName(candidate)) {
      candidates.push(candidate);
    }
  }

  const quotedPattern = /["“”]([A-Z][A-Za-z0-9'’-]{2,}(?:\s+[A-Z][A-Za-z0-9'’-]{2,})?)["“”]/g;
  for (const match of rawTitle.matchAll(quotedPattern)) {
    const candidate = cleanCharacterCandidate(match[1]);
    if (candidate && isLikelyCharacterName(candidate)) {
      candidates.push(candidate);
    }
  }

  const characters = dedupeEntities(
    candidates
      .map((candidate) => {
        const slug = slugifyNewsText(candidate, 64);
        if (!slug || CHARACTER_SLUG_BLOCKLIST.has(slug) || animeSlugs.has(slug)) {
          return null;
        }

        return {
          slug,
          name: candidate,
        };
      })
      .filter(Boolean)
  );

  return characters.slice(0, 4);
}

function extractSeoEntities(article = {}) {
  return {
    anime: buildAnimeEntities(article),
    characters: buildCharacterEntities(article),
    studios: buildStudioEntities(article),
    tags: buildTagEntities(article),
  };
}

function getEntitiesByType(entities = {}, type = "") {
  if (type === "anime") return Array.isArray(entities?.anime) ? entities.anime : [];
  if (type === "character") {
    return Array.isArray(entities?.characters) ? entities.characters : [];
  }
  if (type === "studio") return Array.isArray(entities?.studios) ? entities.studios : [];
  if (type === "tag") return Array.isArray(entities?.tags) ? entities.tags : [];
  return [];
}

function toArticleContract(article) {
  const hydrated = applyArticleDefaults(article);
  const franchise = deriveFranchiseFromRefined(hydrated.refined);
  const newsSlug = buildArticleNewsSlug(hydrated);
  const entities = extractSeoEntities(hydrated);

  return {
    ...hydrated,
    refined: {
      ...hydrated.refined,
      franchiseSlug: franchise.slug || "",
      franchiseName: franchise.name || "",
      newsSlug,
      entities,
    },
  };
}

async function loadAllArticlesForContract() {
  if (USE_MYSQL) {
    const all = await loadAllArticles();
    return all.map((article) => toArticleContract(article));
  }

  return processedArticles.map((article) => toArticleContract(article));
}

function filterArticlesByWindowHours(articles = [], windowHours = 72) {
  const parsedWindow = Number(windowHours);
  if (!Number.isFinite(parsedWindow) || parsedWindow <= 0) {
    return articles.slice();
  }

  const now = Date.now();
  const maxAgeMs = parsedWindow * 60 * 60 * 1000;

  return articles.filter((article) => {
    const refined = article?.refined || {};
    const timestamp = Date.parse(refined.lastSeenAt || article.timestamp || "");
    if (!timestamp || Number.isNaN(timestamp)) return false;
    return now - timestamp <= maxAgeMs;
  });
}

function paginateList(items = [], pagination = {}) {
  const limit = normalizeLimit(pagination.limit, API_DEFAULT_LIMIT);
  const offset = normalizeOffset(pagination.offset);
  const pageItems = items.slice(offset, offset + limit);

  return {
    total: items.length,
    limit,
    offset,
    hasMore: offset + pageItems.length < items.length,
    items: pageItems,
  };
}

function buildSourceSummary(articles = []) {
  const summaryMap = new Map();

  for (const article of articles) {
    const refined = article?.refined || {};
    const sourceId = String(refined.sourceId || "unknown");
    const sourceName =
      String(refined.sourceName || "") ||
      SOURCE_DEFINITIONS[sourceId]?.name ||
      sourceId;
    const key = sourceId;

    if (!summaryMap.has(key)) {
      summaryMap.set(key, {
        sourceId,
        sourceName,
        count: 0,
        scoreTotal: 0,
        newCount: 0,
        revisitedCount: 0,
        updatedCount: 0,
      });
    }

    const row = summaryMap.get(key);
    row.count += 1;
    row.scoreTotal += Number(refined.score || 0);
    if (refined.lastSeenEvent === "new") row.newCount += 1;
    if (refined.lastSeenEvent === "revisited") row.revisitedCount += 1;
    if (refined.lastSeenEvent === "updated") row.updatedCount += 1;
  }

  return Array.from(summaryMap.values())
    .map((row) => ({
      ...row,
      avgScore: row.count ? Number((row.scoreTotal / row.count).toFixed(2)) : 0,
    }))
    .sort((a, b) => b.count - a.count);
}

function buildFranchiseSummary(articles = []) {
  const franchiseMap = new Map();

  for (const article of articles) {
    const refined = article?.refined || {};
    const franchise = deriveFranchiseFromRefined(refined);
    if (!franchise.slug) continue;

    if (!franchiseMap.has(franchise.slug)) {
      franchiseMap.set(franchise.slug, {
        slug: franchise.slug,
        name: franchise.name || slugToName(franchise.slug),
        mentions: 0,
        scoreTotal: 0,
        sourceSet: new Set(),
        maxTrendScore: 0,
        lastSeenAt: "",
      });
    }

    const row = franchiseMap.get(franchise.slug);
    row.mentions += 1;
    row.scoreTotal += Number(refined.score || 0);
    row.sourceSet.add(String(refined.sourceId || "unknown"));
    row.maxTrendScore = Math.max(row.maxTrendScore, Number(refined.topicTrendScore || 0));

    const currentLastSeen = Date.parse(String(row.lastSeenAt || ""));
    const articleLastSeen = Date.parse(String(refined.lastSeenAt || article.timestamp || ""));
    if (
      articleLastSeen &&
      !Number.isNaN(articleLastSeen) &&
      (!currentLastSeen || Number.isNaN(currentLastSeen) || articleLastSeen > currentLastSeen)
    ) {
      row.lastSeenAt = new Date(articleLastSeen).toISOString();
    }
  }

  return Array.from(franchiseMap.values())
    .map((row) => ({
      slug: row.slug,
      name: row.name,
      mentions: row.mentions,
      sourceCount: row.sourceSet.size,
      avgScore: row.mentions ? Number((row.scoreTotal / row.mentions).toFixed(2)) : 0,
      maxTrendScore: row.maxTrendScore,
      lastSeenAt: row.lastSeenAt || "",
    }))
    .sort((a, b) => {
      if (b.mentions !== a.mentions) return b.mentions - a.mentions;
      if (b.maxTrendScore !== a.maxTrendScore) return b.maxTrendScore - a.maxTrendScore;
      return b.avgScore - a.avgScore;
    });
}

function buildTopicSummary(articles = []) {
  const topicMap = new Map();

  for (const article of articles) {
    const refined = article?.refined || {};
    const topicKey = String(refined.topicKey || "").trim();
    if (!topicKey) continue;

    if (!topicMap.has(topicKey)) {
      topicMap.set(topicKey, {
        topicKey,
        mentions: 0,
        scoreTotal: 0,
        sourceSet: new Set(),
        lastSeenAt: "",
      });
    }

    const row = topicMap.get(topicKey);
    row.mentions += 1;
    row.scoreTotal += Number(refined.score || 0);
    row.sourceSet.add(String(refined.sourceId || "unknown"));

    const currentLastSeen = Date.parse(String(row.lastSeenAt || ""));
    const articleLastSeen = Date.parse(String(refined.lastSeenAt || article.timestamp || ""));
    if (
      articleLastSeen &&
      !Number.isNaN(articleLastSeen) &&
      (!currentLastSeen || Number.isNaN(currentLastSeen) || articleLastSeen > currentLastSeen)
    ) {
      row.lastSeenAt = new Date(articleLastSeen).toISOString();
    }
  }

  return Array.from(topicMap.values())
    .map((row) => ({
      topicKey: row.topicKey,
      mentions: row.mentions,
      sourceCount: row.sourceSet.size,
      avgScore: row.mentions ? Number((row.scoreTotal / row.mentions).toFixed(2)) : 0,
      lastSeenAt: row.lastSeenAt || "",
    }))
    .sort((a, b) => {
      if (b.mentions !== a.mentions) return b.mentions - a.mentions;
      return b.avgScore - a.avgScore;
    });
}

function createEntityAggregationRow(type, entity) {
  return {
    type,
    slug: String(entity?.slug || ""),
    name: String(entity?.name || ""),
    count: 0,
    scoreTotal: 0,
    sourceSet: new Set(),
    lastSeenAt: "",
  };
}

function pushEntityAggregation(bucket, type, entity, article) {
  const slug = normalizeQueryText(entity?.slug);
  if (!slug) return;

  const key = `${type}:${slug}`;
  if (!bucket.has(key)) {
    bucket.set(key, createEntityAggregationRow(type, entity));
  }

  const row = bucket.get(key);
  row.count += 1;
  row.scoreTotal += Number(article?.refined?.score || 0);
  row.sourceSet.add(String(article?.refined?.sourceId || "unknown"));

  const currentLastSeen = Date.parse(String(row.lastSeenAt || ""));
  const articleLastSeen = Date.parse(
    String(article?.refined?.lastSeenAt || article?.timestamp || "")
  );
  if (
    articleLastSeen &&
    !Number.isNaN(articleLastSeen) &&
    (!currentLastSeen || Number.isNaN(currentLastSeen) || articleLastSeen > currentLastSeen)
  ) {
    row.lastSeenAt = new Date(articleLastSeen).toISOString();
  }
}

function serializeEntityAggregations(bucket) {
  return Array.from(bucket.values())
    .map((row) => ({
      type: row.type,
      slug: row.slug,
      name: row.name,
      count: row.count,
      sourceCount: row.sourceSet.size,
      avgScore: row.count ? Number((row.scoreTotal / row.count).toFixed(2)) : 0,
      lastSeenAt: row.lastSeenAt || "",
    }))
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      if (b.sourceCount !== a.sourceCount) return b.sourceCount - a.sourceCount;
      return b.avgScore - a.avgScore;
    });
}

function buildEntityIndex(articles = []) {
  const index = {
    anime: new Map(),
    character: new Map(),
    studio: new Map(),
    tag: new Map(),
  };

  for (const article of articles) {
    const entities = article?.refined?.entities || extractSeoEntities(article);
    for (const entity of getEntitiesByType(entities, "anime")) {
      pushEntityAggregation(index.anime, "anime", entity, article);
    }
    for (const entity of getEntitiesByType(entities, "character")) {
      pushEntityAggregation(index.character, "character", entity, article);
    }
    for (const entity of getEntitiesByType(entities, "studio")) {
      pushEntityAggregation(index.studio, "studio", entity, article);
    }
    for (const entity of getEntitiesByType(entities, "tag")) {
      pushEntityAggregation(index.tag, "tag", entity, article);
    }
  }

  return index;
}

function articleContainsEntity(article = {}, type = "", slug = "") {
  const normalizedType = normalizeQueryText(type);
  const normalizedSlug = normalizeQueryText(slug);
  if (!normalizedType || !normalizedSlug) return false;

  const entities = article?.refined?.entities || extractSeoEntities(article);
  if (normalizedType === "anime") {
    return (entities.anime || []).some((entity) => normalizeQueryText(entity?.slug) === normalizedSlug);
  }
  if (normalizedType === "character") {
    return (entities.characters || []).some(
      (entity) => normalizeQueryText(entity?.slug) === normalizedSlug
    );
  }
  if (normalizedType === "studio") {
    return (entities.studios || []).some((entity) => normalizeQueryText(entity?.slug) === normalizedSlug);
  }
  if (normalizedType === "tag") {
    return (entities.tags || []).some((entity) => normalizeQueryText(entity?.slug) === normalizedSlug);
  }

  return false;
}

// Garante que o diretório de dados exista
const dataDir = path.dirname(DATA_FILE);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Garante que o diretório de logs exista (compatível com ecosystem config)
const logsDir = path.resolve(__dirname, "..", "..", "logs");
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

async function loadArticlesFromStorage() {
  try {
    const nowIso = new Date().toISOString();

    if (USE_MYSQL) {
      await ensureDatabaseAndTable();
      const dbArticles = await loadAllArticles();

      if (dbArticles.length) {
        processedArticles = dbArticles.map((article) =>
          applyArticleDefaults(article, nowIso)
        );
        enforceInMemoryWindow();
        rebuildKnownArticleUrls();
        logger.success(
          `Carregados ${processedArticles.length} artigos do MySQL em memória operacional.`
        );
        return;
      }

      if (fs.existsSync(DATA_FILE)) {
        const jsonArticles = loadArticlesFromJsonFile();
        const hydratedJsonArticles = jsonArticles.map((article) =>
          applyArticleDefaults(article, nowIso)
        );
        await saveAllArticlesSnapshot(hydratedJsonArticles);
        processedArticles = hydratedJsonArticles;
        enforceInMemoryWindow();
        rebuildKnownArticleUrls();

        logger.success(
          `Carregados ${processedArticles.length} artigos do JSON e migrados para MySQL.`
        );
        return;
      }

      processedArticles = [];
      rebuildKnownArticleUrls();
      logger.info(
        "Tabela MySQL vazia e sem cache JSON local. Começando do zero."
      );
      return;
    }

    if (!fs.existsSync(DATA_FILE)) {
      logger.info("Nenhum arquivo de cache local encontrado. Começando do zero.");
      processedArticles = [];
      rebuildKnownArticleUrls();
      return;
    }

    const parsed = loadArticlesFromJsonFile();
    processedArticles = parsed.map((article) => applyArticleDefaults(article, nowIso));
    enforceInMemoryWindow();
    rebuildKnownArticleUrls();

    logger.success(
      `Carregados ${processedArticles.length} artigos do cache JSON local.`
    );
  } catch (error) {
    logger.error("Erro ao carregar artigos do armazenamento:", error);
    processedArticles = [];
    rebuildKnownArticleUrls();
  }
}

async function saveArticlesToStorage() {
  try {
    applyTopicTrendScores(processedArticles);
    enforceInMemoryWindow();

    if (USE_MYSQL) {
      await saveAllArticlesSnapshot(processedArticles);
      logger.info("Notícias salvas com sucesso no MySQL.");
      return;
    }

    saveArticlesToJsonFile(processedArticles);
    logger.info(`Notícias salvas com sucesso em ${DATA_FILE}`);
  } catch (error) {
    logger.error("Erro ao salvar notícias no armazenamento:", error);
  }
}

app.get("/", (_req, res) => {
  res.json(processedArticles);
});

app.get("/articles", async (req, res) => {
  try {
    const filters = {
      q: String(req.query.q || "").trim(),
      sourceId: normalizeQueryText(req.query.source || req.query.sourceId),
      bucket: normalizeQueryText(req.query.bucket),
      contentType: normalizeQueryText(req.query.contentType),
      lastSeenEvent: normalizeQueryText(req.query.lastSeenEvent),
      from: parseQueryDate(req.query.from),
      to: parseQueryDate(req.query.to),
    };

    const pagination = {
      limit: req.query.limit,
      offset: req.query.offset,
    };

    const result = await getArticlePage(filters, pagination);
    res.json({
      total: result.total,
      limit: result.limit,
      offset: result.offset,
      hasMore: result.hasMore,
      filters,
      items: result.items.map((item) => toArticleContract(item)),
    });
  } catch (error) {
    logger.error("[API:/articles] Falha ao listar artigos:", error);
    res.status(500).json({
      error: "Falha ao listar artigos.",
    });
  }
});

app.get("/articles/slug/:slug", async (req, res) => {
  try {
    const newsSlug = normalizeQueryText(req.params.slug);
    if (!newsSlug) {
      return res.status(400).json({
        error: "Parâmetro slug inválido.",
      });
    }

    const allArticles = await loadAllArticlesForContract();
    const matches = allArticles
      .filter((article) => {
        const refined = article?.refined || {};
        const candidateSlug = normalizeQueryText(
          refined.newsSlug || buildArticleNewsSlug(article)
        );
        return candidateSlug === newsSlug;
      })
      .sort((a, b) => {
        const byTimestamp = getItemTimestamp(b) - getItemTimestamp(a);
        if (byTimestamp !== 0) return byTimestamp;

        const scoreA = Number(a?.refined?.score || 0);
        const scoreB = Number(b?.refined?.score || 0);
        if (scoreB !== scoreA) return scoreB - scoreA;

        const seenA = Number(a?.refined?.timesSeen || 0);
        const seenB = Number(b?.refined?.timesSeen || 0);
        if (seenB !== seenA) return seenB - seenA;

        return String(a?.id || "").localeCompare(String(b?.id || ""));
      });

    if (!matches.length) {
      return res.status(404).json({
        error: "Artigo não encontrado.",
      });
    }

    return res.json({
      item: toArticleContract(matches[0]),
      candidates: matches.length,
    });
  } catch (error) {
    logger.error("[API:/articles/slug/:slug] Falha ao buscar artigo:", error);
    return res.status(500).json({
      error: "Falha ao buscar artigo.",
    });
  }
});

app.get("/articles/:id", async (req, res) => {
  try {
    const articleId = String(req.params.id || "").trim();
    if (!articleId) {
      return res.status(400).json({
        error: "Parâmetro id inválido.",
      });
    }

    if (USE_MYSQL) {
      const found = await loadArticleById(articleId);
      if (!found) {
        return res.status(404).json({
          error: "Artigo não encontrado.",
        });
      }

      return res.json({
        item: toArticleContract(found),
      });
    }

    const found = processedArticles.find((article) => article.id === articleId);
    if (!found) {
      return res.status(404).json({
        error: "Artigo não encontrado.",
      });
    }

    return res.json({
      item: toArticleContract(found),
    });
  } catch (error) {
    logger.error("[API:/articles/:id] Falha ao buscar artigo:", error);
    return res.status(500).json({
      error: "Falha ao buscar artigo.",
    });
  }
});

app.get("/trends", async (req, res) => {
  try {
    const windowHours = toPositiveInt(req.query.windowHours, 72);
    const top = normalizeLimit(req.query.top, 10);

    if (USE_MYSQL) {
      const trendSnapshot = await queryTrendSnapshot({ top, windowHours });
      return res.json({
        generatedAt: new Date().toISOString(),
        windowHours,
        totals: trendSnapshot.totals,
        topFranchises: trendSnapshot.topFranchises,
        topTopics: trendSnapshot.topTopics,
        topSources: trendSnapshot.topSources,
      });
    }

    const allArticles = await loadAllArticlesForContract();
    const inWindow = filterArticlesByWindowHours(allArticles, windowHours);
    const topFranchises = buildFranchiseSummary(inWindow).slice(0, top);
    const topTopics = buildTopicSummary(inWindow).slice(0, top);
    const topSources = buildSourceSummary(inWindow).slice(0, top);

    res.json({
      generatedAt: new Date().toISOString(),
      windowHours,
      totals: {
        articles: inWindow.length,
        sources: topSources.length,
        franchises: topFranchises.length,
        topics: topTopics.length,
      },
      topFranchises,
      topTopics,
      topSources,
    });
  } catch (error) {
    logger.error("[API:/trends] Falha ao montar tendências:", error);
    res.status(500).json({
      error: "Falha ao montar tendências.",
    });
  }
});

app.get("/franchises", async (req, res) => {
  try {
    const top = normalizeLimit(req.query.top, 120);
    const windowHours = toPositiveInt(req.query.windowHours, 0);
    const hasPagination =
      req.query.limit !== undefined || req.query.offset !== undefined;

    if (USE_MYSQL) {
      const summary = await queryFranchiseSummary({
        top,
        limit: req.query.limit,
        offset: req.query.offset,
        windowHours,
        includePagination: hasPagination,
        includeRanking: true,
        rankingLimit: 5,
      });

      return res.json({
        generatedAt: new Date().toISOString(),
        total: summary.total,
        top,
        limit: summary.limit,
        offset: summary.offset,
        hasMore: summary.hasMore,
        windowHours: windowHours > 0 ? windowHours : null,
        ranking: summary.ranking,
        items: summary.items.map((item) => ({
          ...item,
          name: item.name || slugToName(item.slug),
        })),
      });
    }

    const allArticles = await loadAllArticlesForContract();
    const scoped =
      windowHours > 0
        ? filterArticlesByWindowHours(allArticles, windowHours)
        : allArticles;
    const summaries = buildFranchiseSummary(scoped);
    const ranking = {
      byMentions: summaries.slice(0, 5),
      byAvgScore: summaries
        .slice()
        .sort((a, b) => {
          if (b.avgScore !== a.avgScore) return b.avgScore - a.avgScore;
          if (b.mentions !== a.mentions) return b.mentions - a.mentions;
          return b.maxTrendScore - a.maxTrendScore;
        })
        .slice(0, 5),
      byTrend: summaries
        .slice()
        .sort((a, b) => {
          if (b.maxTrendScore !== a.maxTrendScore) {
            return b.maxTrendScore - a.maxTrendScore;
          }
          if (b.mentions !== a.mentions) return b.mentions - a.mentions;
          return b.avgScore - a.avgScore;
        })
        .slice(0, 5),
    };

    const paged = hasPagination
      ? paginateList(summaries, {
          limit: req.query.limit,
          offset: req.query.offset,
        })
      : {
          total: summaries.length,
          limit: top,
          offset: 0,
          hasMore: top < summaries.length,
          items: summaries.slice(0, top),
        };

    res.json({
      generatedAt: new Date().toISOString(),
      total: summaries.length,
      top,
      limit: paged.limit,
      offset: paged.offset,
      hasMore: paged.hasMore,
      windowHours: windowHours > 0 ? windowHours : null,
      ranking,
      items: paged.items,
    });
  } catch (error) {
    logger.error("[API:/franchises] Falha ao listar franquias:", error);
    res.status(500).json({
      error: "Falha ao listar franquias.",
    });
  }
});

app.get("/franchises/:slug", async (req, res) => {
  try {
    const slug = normalizeQueryText(req.params.slug);
    if (!slug) {
      return res.status(400).json({
        error: "Slug de franquia inválido.",
      });
    }

    const filters = {
      sourceId: normalizeQueryText(req.query.source || req.query.sourceId),
      bucket: normalizeQueryText(req.query.bucket),
      contentType: normalizeQueryText(req.query.contentType),
      lastSeenEvent: normalizeQueryText(req.query.lastSeenEvent),
      from: parseQueryDate(req.query.from),
      to: parseQueryDate(req.query.to),
    };

    const allArticles = await loadAllArticlesForContract();
    const scoped = filterArticlesInMemory(allArticles, filters)
      .filter((article) => {
        const franchise = deriveFranchiseFromRefined(article?.refined || {});
        return franchise.slug === slug;
      })
      .sort((a, b) => getItemTimestamp(b) - getItemTimestamp(a));

    const paged = paginateList(scoped, {
      limit: req.query.limit,
      offset: req.query.offset,
    });

    const sourceDistribution = buildSourceSummary(scoped);
    const contentTypeDistribution = scoped.reduce((acc, article) => {
      const key = String(article?.refined?.contentType || "unknown");
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    res.json({
      slug,
      name: slugToName(slug),
      total: paged.total,
      limit: paged.limit,
      offset: paged.offset,
      hasMore: paged.hasMore,
      filters,
      stats: {
        sourceDistribution,
        contentTypeDistribution,
      },
      items: paged.items.map((article) => toArticleContract(article)),
    });
  } catch (error) {
    logger.error("[API:/franchises/:slug] Falha ao buscar franquia:", error);
    res.status(500).json({
      error: "Falha ao buscar franquia.",
    });
  }
});

app.get("/sources", async (req, res) => {
  try {
    const top = normalizeLimit(req.query.top, 200);
    const windowHours = toPositiveInt(req.query.windowHours, 0);
    let summaryBySource = new Map();

    if (USE_MYSQL) {
      const sourceSummary = await querySourceSummary({ top, windowHours });
      summaryBySource = new Map(
        sourceSummary.items.map((row) => [String(row.sourceId), row])
      );
    } else {
      const allArticles = await loadAllArticlesForContract();
      const scoped = windowHours
        ? filterArticlesByWindowHours(allArticles, windowHours)
        : allArticles;
      summaryBySource = new Map(
        buildSourceSummary(scoped).map((row) => [String(row.sourceId), row])
      );
    }

    const items = Object.values(SOURCE_DEFINITIONS)
      .map((source) => {
        const stats = summaryBySource.get(source.id) || null;
        const hasFeed = Boolean(source.feedUrl);
        const hasHome = Array.isArray(source.homeLinkSelectors) && source.homeLinkSelectors.length > 0;
        const hasSitemap = Boolean(source.enableSitemap && source.sitemapIndexUrl);
        const channels = [
          hasFeed ? "Feed" : "",
          hasHome ? "Home" : "",
          hasSitemap ? "Sitemap" : "",
        ].filter(Boolean);

        return {
          id: source.id,
          name: source.name,
          type: channels.length ? channels.join(" + ") : "Web",
          description: `Coleta via ${channels.length ? channels.join(", ") : "web"} em ${source.domains?.[0] || source.monitorUrl}.`,
          monitorUrl: source.monitorUrl,
          feedUrl: source.feedUrl || "",
          sitemapIndexUrl: source.sitemapIndexUrl || "",
          enabledSitemap: Boolean(source.enableSitemap),
          collectionPriority: Array.isArray(source.collectionPriority)
            ? source.collectionPriority
            : [],
          stats: {
            count: Number(stats?.count || 0),
            avgScore: Number(stats?.avgScore || 0),
            newCount: Number(stats?.newCount || 0),
            revisitedCount: Number(stats?.revisitedCount || 0),
            updatedCount: Number(stats?.updatedCount || 0),
          },
        };
      })
      .sort((a, b) => b.stats.count - a.stats.count)
      .slice(0, top);

    res.json({
      generatedAt: new Date().toISOString(),
      total: items.length,
      top,
      windowHours: windowHours || null,
      items,
    });
  } catch (error) {
    logger.error("[API:/sources] Falha ao listar fontes:", error);
    res.status(500).json({
      error: "Falha ao listar fontes.",
    });
  }
});

app.get("/sources/:sourceId", async (req, res) => {
  try {
    const sourceId = normalizeQueryText(req.params.sourceId);
    const sourceDefinition = SOURCE_DEFINITIONS[sourceId];

    if (!sourceDefinition) {
      return res.status(404).json({
        error: "Fonte não encontrada.",
      });
    }

    const filters = {
      sourceId,
      bucket: normalizeQueryText(req.query.bucket),
      contentType: normalizeQueryText(req.query.contentType),
      lastSeenEvent: normalizeQueryText(req.query.lastSeenEvent),
      from: parseQueryDate(req.query.from),
      to: parseQueryDate(req.query.to),
    };

    const allArticles = await loadAllArticlesForContract();
    const scoped = filterArticlesInMemory(allArticles, filters).sort(
      (a, b) => getItemTimestamp(b) - getItemTimestamp(a)
    );
    const paged = paginateList(scoped, {
      limit: req.query.limit,
      offset: req.query.offset,
    });

    const lifecycle = scoped.reduce(
      (acc, article) => {
        const event = String(article?.refined?.lastSeenEvent || "unknown");
        if (acc[event] === undefined) {
          acc[event] = 0;
        }
        acc[event] += 1;
        return acc;
      },
      {
        new: 0,
        revisited: 0,
        updated: 0,
        fetch_restricted: 0,
        unknown: 0,
      }
    );

    res.json({
      source: {
        id: sourceDefinition.id,
        name: sourceDefinition.name,
        monitorUrl: sourceDefinition.monitorUrl,
        feedUrl: sourceDefinition.feedUrl || "",
        enabledSitemap: Boolean(sourceDefinition.enableSitemap),
      },
      total: paged.total,
      limit: paged.limit,
      offset: paged.offset,
      hasMore: paged.hasMore,
      filters,
      stats: {
        lifecycle,
        contentTypes: scoped.reduce((acc, article) => {
          const key = String(article?.refined?.contentType || "unknown");
          acc[key] = (acc[key] || 0) + 1;
          return acc;
        }, {}),
      },
      items: paged.items.map((article) => toArticleContract(article)),
    });
  } catch (error) {
    logger.error("[API:/sources/:sourceId] Falha ao buscar fonte:", error);
    res.status(500).json({
      error: "Falha ao buscar fonte.",
    });
  }
});

app.get("/seo/entities", async (req, res) => {
  try {
    const requestedType = normalizeQueryText(req.query.type);
    const top = normalizeLimit(req.query.top, 30);
    const windowHours = toPositiveInt(req.query.windowHours, 0);
    const allArticles = await loadAllArticlesForContract();
    const scoped = windowHours
      ? filterArticlesByWindowHours(allArticles, windowHours)
      : allArticles;
    const entityIndex = buildEntityIndex(scoped);

    if (requestedType) {
      if (!SEO_ENTITY_TYPES.has(requestedType)) {
        return res.status(400).json({
          error: "Tipo de entidade inválido. Use: anime, character, studio ou tag.",
        });
      }

      const rows = serializeEntityAggregations(entityIndex[requestedType]).slice(0, top);
      return res.json({
        generatedAt: new Date().toISOString(),
        type: requestedType,
        total: rows.length,
        windowHours: windowHours || null,
        items: rows,
      });
    }

    const payload = {
      anime: serializeEntityAggregations(entityIndex.anime).slice(0, top),
      character: serializeEntityAggregations(entityIndex.character).slice(0, top),
      studio: serializeEntityAggregations(entityIndex.studio).slice(0, top),
      tag: serializeEntityAggregations(entityIndex.tag).slice(0, top),
    };

    return res.json({
      generatedAt: new Date().toISOString(),
      top,
      windowHours: windowHours || null,
      totals: {
        anime: payload.anime.length,
        character: payload.character.length,
        studio: payload.studio.length,
        tag: payload.tag.length,
      },
      items: payload,
    });
  } catch (error) {
    logger.error("[API:/seo/entities] Falha ao montar entidades SEO:", error);
    return res.status(500).json({
      error: "Falha ao montar entidades SEO.",
    });
  }
});

app.get("/seo/:type/:slug", async (req, res) => {
  try {
    const type = normalizeQueryText(req.params.type);
    const slug = normalizeQueryText(req.params.slug);

    if (!SEO_ENTITY_TYPES.has(type)) {
      return res.status(400).json({
        error: "Tipo de entidade inválido. Use: anime, character, studio ou tag.",
      });
    }

    if (!slug) {
      return res.status(400).json({
        error: "Slug inválido.",
      });
    }

    const filters = {
      sourceId: normalizeQueryText(req.query.source || req.query.sourceId),
      bucket: normalizeQueryText(req.query.bucket),
      contentType: normalizeQueryText(req.query.contentType),
      lastSeenEvent: normalizeQueryText(req.query.lastSeenEvent),
      from: parseQueryDate(req.query.from),
      to: parseQueryDate(req.query.to),
    };

    const allArticles = await loadAllArticlesForContract();
    const scoped = filterArticlesInMemory(allArticles, filters)
      .filter((article) => articleContainsEntity(article, type, slug))
      .sort((a, b) => getItemTimestamp(b) - getItemTimestamp(a));

    if (!scoped.length) {
      return res.status(404).json({
        error: "Entidade não encontrada.",
      });
    }

    const paged = paginateList(scoped, {
      limit: req.query.limit,
      offset: req.query.offset,
    });

    const entityIndex = buildEntityIndex(scoped);
    const targetEntity = serializeEntityAggregations(entityIndex[type]).find(
      (entity) => entity.slug === slug
    );

    return res.json({
      entity: targetEntity || {
        type,
        slug,
        name: slugToName(slug),
        count: scoped.length,
        sourceCount: 0,
        avgScore: 0,
        lastSeenAt: "",
      },
      total: paged.total,
      limit: paged.limit,
      offset: paged.offset,
      hasMore: paged.hasMore,
      filters,
      stats: {
        sourceDistribution: buildSourceSummary(scoped),
        contentTypeDistribution: scoped.reduce((acc, article) => {
          const key = String(article?.refined?.contentType || "unknown");
          acc[key] = (acc[key] || 0) + 1;
          return acc;
        }, {}),
      },
      items: paged.items.map((article) => toArticleContract(article)),
    });
  } catch (error) {
    logger.error("[API:/seo/:type/:slug] Falha ao buscar entidade SEO:", error);
    return res.status(500).json({
      error: "Falha ao buscar entidade SEO.",
    });
  }
});

app.get("/debug/sources", debugRateLimiter, requireDebugAccess, (_req, res) => {
  res.json({
    isCheckingNews,
    isShuttingDown,
    sourcesActive: NEWS_SOURCES.map((source) => source.id),
    inMemory: {
      count: processedArticles.length,
      max: IN_MEMORY_MAX_ARTICLES || null,
    },
    inventory: buildInventoryMetrics(processedArticles),
    lastCycle: lastCycleMetrics,
    sourceRuns: lastSourceMetrics,
    observability: observabilityTracker.getSnapshot(),
  });
});

app.get("/debug/alerts", debugRateLimiter, requireDebugAccess, (_req, res) => {
  res.json(observabilityTracker.getSnapshot());
});

async function checkPageForNews() {
  if (isCheckingNews) {
    logger.warn(
      "[Monitor] Verificação anterior ainda está em andamento. Pulando ciclo."
    );
    return;
  }

  if (isShuttingDown) {
    logger.info("[Monitor] Shutdown em progresso. Ciclo ignorado.");
    return;
  }

  isCheckingNews = true;
  const cycleMetrics = createCycleMetrics();

  try {
    logger.info("Verificando as fontes de notícias...");

    const collectedCandidates = [];

    for (const source of NEWS_SOURCES) {
      const sourceMetrics = createSourceMetrics(source);
      cycleMetrics.sourceRuns.push(sourceMetrics);

      try {
        const rawItems = await collectItemsFromSource(source, {
          daysBack: DAYS_BACK,
          maxItemsPerSource: MAX_ITEMS_PER_SOURCE,
          maxSitemapsPerSource: MAX_SITEMAPS_PER_SOURCE,
          metrics: sourceMetrics,
        });

        const normalizedItems = normalizeCollectedItems(rawItems, source);
        const { accepted } = filterItemsBySource(
          normalizedItems,
          source,
          sourceMetrics
        );

        collectedCandidates.push(...accepted);
      } catch (error) {
        sourceMetrics.parseErrorCount += 1;
        logger.error(
          `[Fonte:${source.name}] Falha no pipeline da fonte:`,
          error.message || error
        );
      } finally {
        finishSourceMetrics(sourceMetrics);
      }
    }

    const sourceMetricsTracker = createSourceMetricsTracker(cycleMetrics.sourceRuns);

    if (!collectedCandidates.length) {
      logger.warn("Nenhuma notícia encontrada em nenhuma fonte.");
      return;
    }

    const sortedCandidates = collectedCandidates
      .slice()
      .sort((a, b) => getItemTimestamp(b) - getItemTimestamp(a));

    const {
      accepted: dedupedCandidates,
      duplicates: cycleDuplicates,
    } = dedupeCandidates(sortedCandidates);

    cycleDuplicates.forEach((duplicate) => {
      sourceMetricsTracker.incrementDuplicate(duplicate.sourceId, 1);
    });

    const existingIndexes = buildExistingArticleIndex(processedArticles);
    const seenAt = new Date().toISOString();

    const newCandidates = [];
    let touchedExisting = false;

    for (const candidate of dedupedCandidates) {
      const existingMatch = await matchCandidateWithStorageFallback(
        candidate,
        existingIndexes,
        {
          allowContentHash: false,
        }
      );

      if (existingMatch) {
        const seenResult = markExistingArticleSeen(
          existingMatch.article,
          candidate,
          `pre_process_${existingMatch.reason}`,
          seenAt,
          existingIndexes
        );
        sourceMetricsTracker.incrementDuplicate(candidate.sourceId, 1);
        if (seenResult.eventType === "updated") {
          sourceMetricsTracker.incrementUpdated(candidate.sourceId, 1);
        } else {
          sourceMetricsTracker.incrementRevisited(candidate.sourceId, 1);
        }
        touchedExisting = true;
        continue;
      }

      const urlKey = candidate.canonicalUrl || candidate.url;
      if (urlKey && knownArticleUrls.has(urlKey)) {
        sourceMetricsTracker.incrementDuplicate(candidate.sourceId, 1);
        sourceMetricsTracker.incrementRevisited(candidate.sourceId, 1);
        continue;
      }

      newCandidates.push(candidate);
    }

    if (!newCandidates.length) {
      if (touchedExisting) {
        rebuildKnownArticleUrls();
        await saveArticlesToStorage();
      }

      logger.info("Nenhuma notícia nova encontrada.");
      return;
    }

    const candidatesToProcess = newCandidates.slice(0, MAX_NEW_ARTICLES_PER_CYCLE);

    if (newCandidates.length > candidatesToProcess.length) {
      logger.warn(
        `[Monitor] ${newCandidates.length} notícia(s) nova(s) encontradas. Processando ${candidatesToProcess.length} neste ciclo para controlar custo.`
      );
    }

    const initialRun = knownArticleUrls.size === 0;
    logger.info(
      `${initialRun ? "Inicialização:" : "Novas notícias detectadas:"} ${
        candidatesToProcess.length
      } artigo(s) para processar.`
    );

    const newlyProcessed = await processWithConcurrency(
      candidatesToProcess,
      (candidate) => processArticleCandidate(candidate, new Date().toISOString()),
      ARTICLE_PROCESS_CONCURRENCY
    );

    if (!newlyProcessed.length) {
      if (touchedExisting) {
        rebuildKnownArticleUrls();
        await saveArticlesToStorage();
      }

      logger.warn("Nenhum artigo foi processado com sucesso nesta rodada.");
      return;
    }

    const additions = [];

    for (const article of newlyProcessed) {
      if (article?.refined?.fetchRestricted) {
        sourceMetricsTracker.incrementFetchRestricted(article.refined.sourceId, 1);
      }

      const existingMatch = await matchCandidateWithStorageFallback(
        article.refined,
        existingIndexes,
        {
          allowContentHash: true,
        }
      );

      if (existingMatch) {
        const seenResult = markExistingArticleSeen(
          existingMatch.article,
          article.refined,
          `post_process_${existingMatch.reason}`,
          article.timestamp,
          existingIndexes
        );
        sourceMetricsTracker.incrementDuplicate(article.refined.sourceId, 1);
        if (seenResult.eventType === "updated") {
          sourceMetricsTracker.incrementUpdated(article.refined.sourceId, 1);
        } else {
          sourceMetricsTracker.incrementRevisited(article.refined.sourceId, 1);
        }
        touchedExisting = true;
        continue;
      }

      additions.push(article);
      sourceMetricsTracker.incrementNew(article?.refined?.sourceId, 1);
      indexArticle(existingIndexes, article);
    }

    if (!additions.length && touchedExisting) {
      rebuildKnownArticleUrls();
      await saveArticlesToStorage();
      logger.info("Nenhum artigo novo adicionado; cache atualizado por recorrência.");
      return;
    }

    if (!additions.length) {
      logger.info("Nenhum artigo novo elegível após deduplicação final.");
      return;
    }

    processedArticles = [...additions, ...processedArticles].map((article) =>
      applyArticleDefaults(article)
    );
    enforceInMemoryWindow();

    rebuildKnownArticleUrls();

    logger.success(`${additions.length} artigo(s) adicionado(s) à API.`);
    await saveArticlesToStorage();
  } catch (error) {
    logger.error("Ocorreu um erro no loop de verificação:", error.message || error);
  } finally {
    lastCycleMetrics = finishCycleMetrics(cycleMetrics);
    lastSourceMetrics = cycleMetrics.sourceRuns;
    try {
      observabilityTracker.ingestCycleMetrics(lastCycleMetrics);
      emitObservabilityAlerts(observabilityTracker.getSnapshot());
    } catch (observabilityError) {
      logger.error(
        "[Observability] Falha ao atualizar dashboard/alertas:",
        observabilityError?.message || observabilityError
      );
    }
    isCheckingNews = false;
  }
}

async function cleanupExpiredArticles() {
  const now = Date.now();
  let expiredCount = 0;

  processedArticles.forEach((article) => {
    const timestamp = new Date(article.timestamp).getTime();
    if (Number.isNaN(timestamp)) {
      expiredCount += 1;
      return;
    }

    const articleAge = now - timestamp;
    if (articleAge >= EXPIRATION_TIME_MS) {
      expiredCount += 1;
    }
  });

  if (expiredCount > 0) {
    logger.info(
      `[Manutenção] ${expiredCount} artigo(s) estão fora da janela de expiração, mas foram preservados no histórico.`
    );
  }
}

let checkIntervalId = null;
let cleanupIntervalId = null;

function startServer() {
  const server = app.listen(PORT, HOST, async () => {
    logger.success(`Servidor rodando em ${HOST}:${PORT}.`);
    if (USE_MYSQL) {
      logger.info("Persistência ativa: MySQL.");
    } else {
      logger.warn("Persistência ativa: JSON local (DB_* não configurado).");
    }
    await loadArticlesFromStorage();

    const sourcesSummary = NEWS_SOURCES.map(
      (source) => `${source.name} (${source.monitorUrl})`
    ).join(", ");
    logger.info(`Fontes ativas: ${sourcesSummary}`);
    logger.info("Iniciando o monitoramento de notícias...");

    await checkPageForNews();
    checkIntervalId = setInterval(checkPageForNews, CHECK_INTERVAL_MS);
    cleanupIntervalId = setInterval(() => {
      cleanupExpiredArticles().catch((error) => {
        logger.error("[Manutenção] Falha ao limpar artigos expirados:", error);
      });
    }, CLEANUP_INTERVAL_MS);
  });

  async function gracefulShutdown(signal) {
    if (isShuttingDown) return;
    isShuttingDown = true;

    try {
      logger.info(
        `[Shutdown] Recebido sinal: ${signal}. Iniciando término gracioso...`
      );

      if (checkIntervalId) clearInterval(checkIntervalId);
      if (cleanupIntervalId) clearInterval(cleanupIntervalId);

      await saveArticlesToStorage();

      server.close((err) => {
        if (err) {
          logger.error("[Shutdown] Erro ao fechar servidor:", err);
          process.exit(1);
        } else {
          logger.success("[Shutdown] Encerramento finalizado.");
          process.exit(0);
        }
      });

      setTimeout(() => {
        logger.warn("[Shutdown] Forçando saída após timeout.");
        process.exit(0);
      }, 5000);
    } catch (error) {
      logger.error("[Shutdown] Exceção durante shutdown:", error);
      process.exit(1);
    }
  }

  process.on("SIGINT", () => gracefulShutdown("SIGINT"));
  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.on("SIGUSR2", () => gracefulShutdown("SIGUSR2"));

  process.on("uncaughtException", (err) => {
    logger.error("[uncaughtException]", err);
    saveArticlesToStorage();
    setTimeout(() => process.exit(1), 1000);
  });

  process.on("unhandledRejection", (reason) => {
    logger.error("[unhandledRejection]", reason);
    saveArticlesToStorage();
    setTimeout(() => process.exit(1), 1000);
  });
}

startServer();
