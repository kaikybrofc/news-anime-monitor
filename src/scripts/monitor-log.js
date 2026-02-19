const fs = require("fs");
const path = require("path");
const { summarizeUrl } = require("../services/summarizer.js");
const logger = require("../utils/logger.js");
const { getWithRetry, toPositiveInt } = require("../utils/http.js");
const {
  isArticleUrl,
  extractArticlesFromHomeHtml,
  extractArticlesFromFeed,
  extractSitemapsFromIndex,
  extractUrlsFromSitemap,
  filterByDays,
  inferTitleFromUrl,
} = require("../utils/article-utils.js");

// --- CONFIGURAÇÃO ---
const URL_TO_MONITOR = "https://animenew.com.br/";
const FEED_URL = "https://animenew.com.br/feed/";
const SITEMAP_INDEX_URL = "https://animenew.com.br/sitemap_index.xml";
const DAYS_BACK = toPositiveInt(process.env.DAYS_BACK, 3);
const MAX_ITEMS = toPositiveInt(process.env.MAX_ITEMS, 50);
const MAX_SITEMAPS = toPositiveInt(process.env.MAX_SITEMAPS, 5);
const CHECK_INTERVAL_MS = toPositiveInt(
  process.env.MONITOR_LOG_CHECK_INTERVAL_MS,
  43200000
); // 12 horas
const LOG_FILE = path.resolve(__dirname, "latest_news.log");
// --- FIM DA CONFIGURAÇÃO ---

logger.info(`Iniciando monitoramento de notícias em: ${URL_TO_MONITOR}`);
logger.info(`Verificando a cada ${CHECK_INTERVAL_MS / 1000 / 60} minutos.`);
logger.info(`Todos os resumos e um resumão serão salvos em: ${LOG_FILE}`);
logger.info(`Caminho absoluto do arquivo de log: ${LOG_FILE}`);

const checkPageForNews = async () => {
  try {
    logger.info("Buscando página e procurando por notícias...");
    const response = await getWithRetry(URL_TO_MONITOR, {
      context: "MonitorLog/Home",
    });

    // 1) Tenta usar o sitemap (melhor para varredura ampla do site)
    let sitemapItems = [];
    try {
      const indexResponse = await getWithRetry(SITEMAP_INDEX_URL, {
        context: "MonitorLog/SitemapIndex",
      });
      const sitemaps = extractSitemapsFromIndex(indexResponse.data).slice(
        0,
        MAX_SITEMAPS
      );

      const seen = new Set();
      for (const sitemapUrl of sitemaps) {
        const smResponse = await getWithRetry(sitemapUrl, {
          context: "MonitorLog/SitemapFile",
        });
        const urls = extractUrlsFromSitemap(smResponse.data);
        for (const entry of urls) {
          if (!isArticleUrl(entry.url)) continue;
          if (seen.has(entry.url)) continue;
          seen.add(entry.url);
          sitemapItems.push({
            name: inferTitleFromUrl(entry.url),
            url: entry.url,
            lastmod: entry.lastmod,
          });
        }
        if (sitemapItems.length >= MAX_ITEMS) break;
      }

      sitemapItems = filterByDays(sitemapItems, DAYS_BACK);
    } catch (_error) {
      logger.warn("Não foi possível acessar o sitemap. Usando o feed/home.");
    }

    // 2) Tenta usar o feed (melhor para buscar dias anteriores)
    let feedItems = [];
    try {
      const feedResponse = await getWithRetry(FEED_URL, {
        context: "MonitorLog/Feed",
      });
      feedItems = extractArticlesFromFeed(feedResponse.data);
      feedItems = filterByDays(feedItems, DAYS_BACK);
    } catch (_error) {
      logger.warn("Não foi possível acessar o feed. Usando a home.");
    }

    let articles = sitemapItems.length
      ? sitemapItems
      : feedItems.length
      ? feedItems
      : extractArticlesFromHomeHtml(response.data);

    if (articles.length > MAX_ITEMS) {
      articles = articles.slice(0, MAX_ITEMS);
    }

    if (!articles.length) {
      logger.warn("Não foi possível encontrar notícias na página inicial.");
      logger.warn(
        "Verifique se a estrutura da página mudou ou se há bloqueio de acesso."
      );
      return;
    }

    // Processa todos os itens da lista
    const allSummaries = [];
    const resumaoTextos = [];

    for (const article of articles) {
      logger.info(`Processando: ${article.name}`);
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

    // Gera o resumão geral
    const resumao =
      resumaoTextos.length > 0
        ? resumaoTextos.join("\n")
        : "Nenhum resumo gerado.";
    const resumaoEntry = `========== RESUMÃO GERAL ==========\n${resumao}\n===================================\n\n`;

    // Salva todos os resumos e o resumão no log
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
