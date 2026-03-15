const express = require("express");
const fs = require("fs");
const path = require("path");
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
  saveAllArticlesSnapshot,
} = require("../db/articles-repository.js");
const { hasDbConfig } = require("../db/mysql.js");

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
const DATA_FILE = path.resolve(
  __dirname,
  "..",
  "data",
  "processed_articles.json"
);
// --- FIM DA CONFIGURAÇÃO ---

const app = express();
const knownArticleUrls = new Set();
let processedArticles = [];
let isCheckingNews = false;
let isShuttingDown = false;
let lastCycleMetrics = null;
let lastSourceMetrics = [];

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
  const dateValue =
    item?.publishedAt ||
    item?.pubDate ||
    item?.lastmod ||
    item?.timestamp ||
    item?.refined?.publishedAt ||
    item?.refined?.lastSeenAt;
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
    (a, b) => getItemTimestamp(b) - getItemTimestamp(a)
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

function toArticleContract(article) {
  const hydrated = applyArticleDefaults(article);
  const franchise = deriveFranchiseFromRefined(hydrated.refined);

  return {
    ...hydrated,
    refined: {
      ...hydrated.refined,
      franchiseSlug: franchise.slug || "",
      franchiseName: franchise.name || "",
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

app.get("/debug/sources", (_req, res) => {
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
  });
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
