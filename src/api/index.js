const express = require("express");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");
const { summarizeHtml } = require("../services/summarizer.js");
const logger = require("../utils/logger.js");
const { getWithRetry, toPositiveInt } = require("../utils/http.js");
const {
  isLikelyUrl,
  extractArticlesFromHomeHtml,
  extractArticlesFromFeed,
  extractSitemapsFromIndex,
  extractUrlsFromSitemap,
  filterByDays,
  inferTitleFromUrl,
  extractTitleFromHtml,
} = require("../utils/article-utils.js");
const { getNewsSources } = require("../config/news-sources.js");

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

function extractImageFromHtml(html) {
  const $ = cheerio.load(html);
  const ogImage =
    $('meta[property="og:image"]').attr("content") ||
    $('meta[name="twitter:image"]').attr("content");
  if (ogImage) return ogImage.trim();

  const featured =
    $(".featured-img").first().attr("data-lazy-src") ||
    $(".featured-img").first().attr("src");
  if (featured) return featured.trim();

  const contentImage =
    $(".entry-content img").first().attr("data-lazy-src") ||
    $(".entry-content img").first().attr("src");
  if (contentImage) return contentImage.trim();

  return "";
}

function rebuildKnownArticleUrls() {
  knownArticleUrls.clear();
  processedArticles.forEach((article) => {
    const url = article?.refined?.url;
    if (url) knownArticleUrls.add(url);
  });
}

function normalizeNameKey(value) {
  return String(value || "").trim().toLowerCase();
}

function resolveArticleName(articleInfo, html) {
  const providedName = String(articleInfo?.name || "").trim();
  const inferredName = inferTitleFromUrl(articleInfo.url);

  const hasStrongProvidedName =
    providedName &&
    !isLikelyUrl(providedName) &&
    normalizeNameKey(providedName) !== normalizeNameKey(inferredName);

  if (hasStrongProvidedName) {
    return providedName;
  }

  const extractedTitle = extractTitleFromHtml(html, articleInfo.sourceConfig);
  if (extractedTitle) {
    return extractedTitle;
  }

  return providedName || inferredName;
}

function getItemTimestamp(item) {
  const dateValue = item.pubDate || item.lastmod;
  if (!dateValue) return 0;

  const parsed = Date.parse(dateValue);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function dedupeByUrl(items) {
  const seen = new Set();
  const deduped = [];

  items.forEach((item) => {
    if (!item?.url || seen.has(item.url)) return;
    seen.add(item.url);
    deduped.push(item);
  });

  return deduped;
}

function enrichSitemapNames(sitemapItems, feedItems) {
  if (!sitemapItems.length || !feedItems.length) return sitemapItems;

  const feedTitlesByUrl = new Map(
    feedItems
      .filter((item) => item.url && item.name)
      .map((item) => [item.url, item.name])
  );

  return sitemapItems.map((item) => {
    const feedTitle = feedTitlesByUrl.get(item.url);
    if (!feedTitle) return item;

    return {
      ...item,
      name: feedTitle,
    };
  });
}

function attachSourceInfo(items, source) {
  return items.map((item) => ({
    ...item,
    sourceId: source.id,
    sourceName: source.name,
    sourceConfig: source,
  }));
}

async function collectItemsFromSource(source) {
  const sourceTag = `[Fonte:${source.name}]`;
  const sourceHeaders = source.requestHeaders;

  // 1) Sitemap
  let sitemapItems = [];
  if (source.enableSitemap && source.sitemapIndexUrl) {
    try {
      const indexResponse = await getWithRetry(source.sitemapIndexUrl, {
        context: `${source.name}/SitemapIndex`,
        headers: sourceHeaders,
      });

      const maxSitemaps = toPositiveInt(
        source.maxSitemaps,
        MAX_SITEMAPS_PER_SOURCE
      );
      const sitemaps = extractSitemapsFromIndex(indexResponse.data).slice(
        0,
        maxSitemaps
      );

      const seenSitemapUrls = new Set();
      for (const sitemapUrl of sitemaps) {
        const smResponse = await getWithRetry(sitemapUrl, {
          context: `${source.name}/SitemapFile`,
          headers: sourceHeaders,
        });

        const urls = extractUrlsFromSitemap(smResponse.data, source);
        urls.forEach((entry) => {
          if (seenSitemapUrls.has(entry.url)) return;
          seenSitemapUrls.add(entry.url);
          sitemapItems.push({
            name: inferTitleFromUrl(entry.url),
            url: entry.url,
            lastmod: entry.lastmod,
          });
        });

        if (sitemapItems.length >= MAX_ITEMS_PER_SOURCE) break;
      }

      sitemapItems = filterByDays(sitemapItems, DAYS_BACK);
    } catch (_error) {
      logger.warn(`${sourceTag} Não foi possível acessar o sitemap.`);
    }
  }

  // 2) Feed
  let feedItems = [];
  if (source.feedUrl) {
    try {
      const feedResponse = await getWithRetry(source.feedUrl, {
        context: `${source.name}/Feed`,
        headers: sourceHeaders,
      });

      feedItems = extractArticlesFromFeed(feedResponse.data, source);
      feedItems = filterByDays(feedItems, DAYS_BACK);
    } catch (_error) {
      logger.warn(`${sourceTag} Não foi possível acessar o feed.`);
    }
  }

  sitemapItems = enrichSitemapNames(sitemapItems, feedItems);

  // 3) Home / categoria
  let homeItems = [];
  const hasPrimaryItems = sitemapItems.length || feedItems.length;
  if (!hasPrimaryItems && source.monitorUrl) {
    try {
      const homeResponse = await getWithRetry(source.monitorUrl, {
        context: `${source.name}/Home`,
        headers: sourceHeaders,
      });

      homeItems = extractArticlesFromHomeHtml(homeResponse.data, source);
    } catch (_error) {
      logger.warn(`${sourceTag} Não foi possível acessar a página principal da fonte.`);
    }
  }

  const buckets = {
    sitemap: sitemapItems,
    feed: feedItems,
    home: homeItems,
  };

  const priority = Array.isArray(source.collectionPriority)
    ? source.collectionPriority
    : ["sitemap", "feed", "home"];

  let selectedBucketName = "none";
  let selectedItems = [];

  for (const bucketName of priority) {
    const bucketItems = buckets[bucketName] || [];
    if (!bucketItems.length) continue;

    selectedBucketName = bucketName;
    selectedItems = bucketItems;
    break;
  }

  if (!selectedItems.length) {
    logger.warn(`${sourceTag} Nenhum item coletado nesta fonte.`);
    return [];
  }

  if (selectedItems.length > MAX_ITEMS_PER_SOURCE) {
    selectedItems = selectedItems.slice(0, MAX_ITEMS_PER_SOURCE);
  }

  logger.info(
    `${sourceTag} ${selectedItems.length} item(ns) coletados via ${selectedBucketName}.`
  );

  return attachSourceInfo(selectedItems, source);
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

function loadArticlesFromFile() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = fs.readFileSync(DATA_FILE, "utf8");
      const parsed = JSON.parse(data);

      if (!Array.isArray(parsed)) {
        throw new Error("Formato inválido de cache: esperado um array.");
      }

      processedArticles = parsed.filter((article) => article?.refined?.url);
      rebuildKnownArticleUrls();

      logger.success(
        `Carregados ${processedArticles.length} artigos do cache local.`
      );
    } else {
      logger.info(
        "Nenhum arquivo de cache local encontrado. Começando do zero."
      );
    }
  } catch (error) {
    logger.error("Erro ao carregar ou analisar o arquivo de cache local:", error);
    processedArticles = [];
    rebuildKnownArticleUrls();
  }
}

function saveArticlesToFile() {
  try {
    fs.writeFileSync(
      DATA_FILE,
      JSON.stringify(processedArticles, null, 2),
      "utf8"
    );
    logger.info(`Notícias salvas com sucesso em ${DATA_FILE}`);
  } catch (error) {
    logger.error("Erro ao salvar notícias no arquivo:", error);
  }
}

app.get("/", (_req, res) => {
  res.json(processedArticles);
});

async function processArticle(articleInfo) {
  try {
    const sourceTag = articleInfo.sourceName
      ? `[${articleInfo.sourceName}] `
      : "";
    logger.info(
      `${sourceTag}Processando: ${articleInfo.name || articleInfo.url}`
    );

    const articlePageResponse = await getWithRetry(articleInfo.url, {
      context: `${articleInfo.sourceName || "Artigo"}/Fetch`,
      headers: articleInfo.sourceConfig?.requestHeaders,
    });

    const html = articlePageResponse.data;
    const summary = await summarizeHtml(html);
    const extractedImage = extractImageFromHtml(html);
    const image = articleInfo.image || extractedImage || "";
    const name = resolveArticleName(articleInfo, html);

    if (!image) {
      logger.warn(`[Imagem] Nenhuma imagem encontrada: ${articleInfo.url}`);
    }

    const id = crypto.createHash("sha1").update(articleInfo.url).digest("hex");

    return {
      id,
      timestamp: new Date().toISOString(),
      refined: {
        name,
        url: articleInfo.url,
        image,
        summary,
      },
    };
  } catch (error) {
    logger.error(
      `Erro ao processar o artigo "${articleInfo.name || articleInfo.url}":`,
      error.message || error
    );
    return null;
  }
}

async function processWithConcurrency(items, worker, concurrency) {
  if (!items.length) return [];

  const results = new Array(items.length);
  const limit = Math.max(1, Math.min(concurrency, items.length));
  let nextIndex = 0;

  async function runWorker() {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;

      if (index >= items.length) {
        return;
      }

      results[index] = await worker(items[index]);
    }
  }

  await Promise.all(Array.from({ length: limit }, () => runWorker()));
  return results.filter(Boolean);
}

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

  try {
    logger.info("Verificando as fontes de notícias...");

    const collectedItems = [];

    for (const source of NEWS_SOURCES) {
      const sourceItems = await collectItemsFromSource(source);
      collectedItems.push(...sourceItems);
    }

    if (!collectedItems.length) {
      logger.warn("Nenhuma notícia encontrada em nenhuma fonte.");
      return;
    }

    const candidates = dedupeByUrl(
      collectedItems
        .slice()
        .sort((a, b) => getItemTimestamp(b) - getItemTimestamp(a))
    );

    const newArticles = candidates.filter(
      (article) => article?.url && !knownArticleUrls.has(article.url)
    );

    if (!newArticles.length) {
      logger.info("Nenhuma notícia nova encontrada.");
      return;
    }

    const articlesToProcess = newArticles.slice(0, MAX_NEW_ARTICLES_PER_CYCLE);

    if (newArticles.length > articlesToProcess.length) {
      logger.warn(
        `[Monitor] ${newArticles.length} notícia(s) nova(s) encontradas. Processando ${articlesToProcess.length} neste ciclo para controlar custo.`
      );
    }

    const initialRun = knownArticleUrls.size === 0;
    logger.info(
      `${initialRun ? "Inicialização:" : "Novas notícias detectadas:"} ${
        articlesToProcess.length
      } artigo(s) para processar.`
    );

    const newlyProcessed = await processWithConcurrency(
      articlesToProcess,
      processArticle,
      ARTICLE_PROCESS_CONCURRENCY
    );

    if (!newlyProcessed.length) {
      logger.warn("Nenhum artigo foi processado com sucesso nesta rodada.");
      return;
    }

    processedArticles = [...newlyProcessed, ...processedArticles];
    rebuildKnownArticleUrls();

    logger.success(`${newlyProcessed.length} artigo(s) adicionado(s) à API.`);
    saveArticlesToFile();
  } catch (error) {
    logger.error("Ocorreu um erro no loop de verificação:", error.message || error);
  } finally {
    isCheckingNews = false;
  }
}

function cleanupExpiredArticles() {
  const now = Date.now();
  const originalCount = processedArticles.length;

  processedArticles = processedArticles.filter((article) => {
    const timestamp = new Date(article.timestamp).getTime();
    if (Number.isNaN(timestamp)) return false;

    const articleAge = now - timestamp;
    return articleAge < EXPIRATION_TIME_MS;
  });

  rebuildKnownArticleUrls();

  const removedCount = originalCount - processedArticles.length;
  if (removedCount > 0) {
    logger.info(`[Manutenção] Removidos ${removedCount} artigo(s) expirado(s).`);
    saveArticlesToFile();
  }
}

let checkIntervalId = null;
let cleanupIntervalId = null;

function startServer() {
  const server = app.listen(PORT, () => {
    logger.success(`Servidor rodando na porta ${PORT}.`);
    loadArticlesFromFile();

    const sourcesSummary = NEWS_SOURCES.map(
      (source) => `${source.name} (${source.monitorUrl})`
    ).join(", ");
    logger.info(`Fontes ativas: ${sourcesSummary}`);
    logger.info("Iniciando o monitoramento de notícias...");

    checkPageForNews();
    checkIntervalId = setInterval(checkPageForNews, CHECK_INTERVAL_MS);
    cleanupIntervalId = setInterval(
      cleanupExpiredArticles,
      CLEANUP_INTERVAL_MS
    );
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

      saveArticlesToFile();

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
    saveArticlesToFile();
    setTimeout(() => process.exit(1), 1000);
  });

  process.on("unhandledRejection", (reason) => {
    logger.error("[unhandledRejection]", reason);
    saveArticlesToFile();
    setTimeout(() => process.exit(1), 1000);
  });
}

startServer();
