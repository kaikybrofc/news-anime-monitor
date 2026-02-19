const fs = require("fs");
const path = require("path");
const { summarizeUrl } = require("../services/summarizer.js");
const logger = require("../utils/logger.js");
const { getWithRetry, toPositiveInt } = require("../utils/http.js");
const {
  extractArticlesFromHomeHtml,
  extractArticlesFromFeed,
  extractSitemapsFromIndex,
  extractUrlsFromSitemap,
  filterByDays,
  inferTitleFromUrl,
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
const MAX_MONITOR_LOG_ITEMS = toPositiveInt(
  process.env.MAX_MONITOR_LOG_ITEMS,
  MAX_ITEMS_PER_SOURCE * Math.max(1, NEWS_SOURCES.length)
);
const CHECK_INTERVAL_MS = toPositiveInt(
  process.env.MONITOR_LOG_CHECK_INTERVAL_MS,
  43200000
); // 12 horas
const LOG_FILE = path.resolve(__dirname, "latest_news.log");
// --- FIM DA CONFIGURAÇÃO ---

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
  }));
}

async function collectItemsFromSource(source) {
  const sourceTag = `[Fonte:${source.name}]`;

  // 1) Sitemap
  let sitemapItems = [];
  if (source.enableSitemap && source.sitemapIndexUrl) {
    try {
      const indexResponse = await getWithRetry(source.sitemapIndexUrl, {
        context: `${source.name}/SitemapIndex`,
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

const sourceSummary = NEWS_SOURCES.map(
  (source) => `${source.name} (${source.monitorUrl})`
).join(", ");
logger.info(`Iniciando monitoramento de notícias: ${sourceSummary}`);
logger.info(`Verificando a cada ${CHECK_INTERVAL_MS / 1000 / 60} minutos.`);
logger.info(`Todos os resumos e um resumão serão salvos em: ${LOG_FILE}`);
logger.info(`Caminho absoluto do arquivo de log: ${LOG_FILE}`);

const checkPageForNews = async () => {
  try {
    logger.info("Buscando fontes e procurando por notícias...");

    const collectedItems = [];

    for (const source of NEWS_SOURCES) {
      const sourceItems = await collectItemsFromSource(source);
      collectedItems.push(...sourceItems);
    }

    let articles = dedupeByUrl(
      collectedItems
        .slice()
        .sort((a, b) => getItemTimestamp(b) - getItemTimestamp(a))
    );

    if (articles.length > MAX_MONITOR_LOG_ITEMS) {
      articles = articles.slice(0, MAX_MONITOR_LOG_ITEMS);
    }

    if (!articles.length) {
      logger.warn("Não foi possível encontrar notícias nas fontes configuradas.");
      return;
    }

    const allSummaries = [];
    const resumaoTextos = [];

    for (const article of articles) {
      const sourceTag = article.sourceName ? `[${article.sourceName}] ` : "";
      logger.info(`${sourceTag}Processando: ${article.name}`);

      let summary = "";
      try {
        summary = await summarizeUrl(article.url);
      } catch (error) {
        logger.error(`Erro ao resumir notícia (${article.url}):`, error);
        summary = "[ERRO AO RESUMIR]";
      }

      const timestamp = new Date().toISOString();
      const logEntry = `[${timestamp}] ${article.name}\nURL: ${article.url}\nRESUMO: ${summary}\n\n`;
      allSummaries.push(logEntry);
      resumaoTextos.push(`- ${article.name}: ${summary}`);
    }

    const resumao =
      resumaoTextos.length > 0
        ? resumaoTextos.join("\n")
        : "Nenhum resumo gerado.";
    const resumaoEntry = `========== RESUMÃO GERAL ==========\n${resumao}\n===================================\n\n`;

    try {
      fs.appendFileSync(LOG_FILE, allSummaries.join("") + resumaoEntry);
      logger.success(`Todos os resumos e o resumão salvos em ${LOG_FILE}`);
    } catch (error) {
      logger.error("Erro ao escrever no arquivo de log:", error);
    }
  } catch (error) {
    logger.error("Ocorreu um erro:", error);
  }
};

checkPageForNews();
setInterval(checkPageForNews, CHECK_INTERVAL_MS);
