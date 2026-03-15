const express = require("express");
const fs = require("fs");
const path = require("path");
const logger = require("../utils/logger.js");
const { toPositiveInt } = require("../utils/http.js");
const { getNewsSources } = require("../config/news-sources.js");
const {
  processArticleCandidate,
  processWithConcurrency,
} = require("../services/article-processor.js");
const {
  createSourceMetricsTracker,
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
  loadAllArticles,
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

function getItemTimestamp(item) {
  const dateValue = item.publishedAt || item.pubDate || item.lastmod;
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
        rebuildKnownArticleUrls();
        logger.success(
          `Carregados ${processedArticles.length} artigos do MySQL.`
        );
        return;
      }

      if (fs.existsSync(DATA_FILE)) {
        const jsonArticles = loadArticlesFromJsonFile();
        processedArticles = jsonArticles.map((article) =>
          applyArticleDefaults(article, nowIso)
        );
        await saveAllArticlesSnapshot(processedArticles);
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

app.get("/debug/sources", (_req, res) => {
  res.json({
    isCheckingNews,
    isShuttingDown,
    sourcesActive: NEWS_SOURCES.map((source) => source.id),
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
      const existingMatch = matchCandidateToExisting(candidate, existingIndexes, {
        allowContentHash: false,
      });

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

      const existingMatch = matchCandidateToExisting(article.refined, existingIndexes, {
        allowContentHash: true,
      });

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
