const axios = require("axios");
const fs = require("fs");
const cheerio = require("cheerio");
const { summarizeUrl } = require("../services/summarizer.js");
const logger = require("../utils/logger.js");

// --- CONFIGURAÇÃO ---
const URL_TO_MONITOR = "https://animenew.com.br/";
const FEED_URL = "https://animenew.com.br/feed/";
const SITEMAP_INDEX_URL = "https://animenew.com.br/sitemap_index.xml";
const DAYS_BACK = 3; // Quantos dias no passado coletar
const MAX_ITEMS = 50; // Limite para evitar resumos demais
const MAX_SITEMAPS = 5; // Evita varredura muito grande
const CHECK_INTERVAL_MS = 43200000; // Atualizado para 12 horas (43.200.000 ms)
const path = require("path");
const LOG_FILE = path.resolve(__dirname, "latest_news.log");
// --- FIM DA CONFIGURAÇÃO ---

let lastKnownTopArticleUrl = "";

const EXCLUDED_PATH_PREFIXES = [
  "/animes/",
  "/mangas/",
  "/games/",
  "/otaku/",
  "/cinema/",
  "/light-novel/",
  "/temporadas/",
  "/category/",
  "/tag/",
  "/author/",
  "/page/",
  "/wp-",
];

function isArticleUrl(href) {
  if (!href) return false;
  try {
    const url = new URL(href);
    if (url.hostname !== "animenew.com.br") return false;
    if (url.search || url.hash) return false;
    const path = url.pathname || "/";
    if (path === "/" || path === "") return false;
    return !EXCLUDED_PATH_PREFIXES.some((prefix) => path.startsWith(prefix));
  } catch {
    return false;
  }
}

function extractArticlesFromHome($) {
  const seen = new Set();
  const items = [];

  $(".entry-title .p-url").each((_, el) => {
    const href = $(el).attr("href");
    const title = $(el).text().trim();
    if (!isArticleUrl(href)) return;
    if (seen.has(href)) return;
    if (!title) return;
    seen.add(href);
    items.push({ name: title, url: href });
  });

  return items;
}

function extractArticlesFromFeed(xml) {
  const $ = cheerio.load(xml, { xmlMode: true });
  const items = [];
  const seen = new Set();

  $("item").each((_, el) => {
    const title = $(el).find("title").first().text().trim();
    const link = $(el).find("link").first().text().trim();
    const pubDate = $(el).find("pubDate").first().text().trim();
    if (!link || !title) return;
    if (seen.has(link)) return;
    seen.add(link);
    items.push({ name: title, url: link, pubDate });
  });

  return items;
}

function extractSitemapsFromIndex(xml) {
  const $ = cheerio.load(xml, { xmlMode: true });
  const items = [];
  $("sitemap > loc").each((_, el) => {
    const loc = $(el).text().trim();
    if (loc) items.push(loc);
  });
  return items;
}

function extractUrlsFromSitemap(xml) {
  const $ = cheerio.load(xml, { xmlMode: true });
  const items = [];
  $("url").each((_, el) => {
    const loc = $(el).find("loc").first().text().trim();
    const lastmod = $(el).find("lastmod").first().text().trim();
    if (loc) items.push({ url: loc, lastmod });
  });
  return items;
}

function filterByDays(items, daysBack) {
  if (!daysBack || daysBack <= 0) return items;
  const now = Date.now();
  const maxAge = daysBack * 24 * 60 * 60 * 1000;
  return items.filter((item) => {
    const dateStr = item.pubDate || item.lastmod;
    if (!dateStr) return true;
    const ts = Date.parse(dateStr);
    if (Number.isNaN(ts)) return true;
    return now - ts <= maxAge;
  });
}

logger.info(`Iniciando monitoramento de notícias em: ${URL_TO_MONITOR}`);
logger.info(`Verificando a cada ${CHECK_INTERVAL_MS / 1000 / 60} minutos.`);
logger.info(`Todos os resumos e um resumão serão salvos em: ${LOG_FILE}`);
logger.info(`Caminho absoluto do arquivo de log: ${LOG_FILE}`);

const checkPageForNews = async () => {
  try {
    logger.info("Buscando página e procurando por notícias...");
    const response = await axios.get(URL_TO_MONITOR, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      },
    });
    const htmlContent = response.data;
    const $ = cheerio.load(htmlContent);

    // 1) Tenta usar o sitemap (melhor para varredura ampla do site)
    let sitemapItems = [];
    try {
      const indexResponse = await axios.get(SITEMAP_INDEX_URL, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
        },
      });
      const sitemaps = extractSitemapsFromIndex(indexResponse.data).slice(
        0,
        MAX_SITEMAPS
      );

      const seen = new Set();
      for (const sitemapUrl of sitemaps) {
        const smResponse = await axios.get(sitemapUrl, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
          },
        });
        const urls = extractUrlsFromSitemap(smResponse.data);
        for (const entry of urls) {
          if (!isArticleUrl(entry.url)) continue;
          if (seen.has(entry.url)) continue;
          seen.add(entry.url);
          sitemapItems.push({
            name: entry.url,
            url: entry.url,
            lastmod: entry.lastmod,
          });
        }
        if (sitemapItems.length >= MAX_ITEMS) break;
      }

      sitemapItems = filterByDays(sitemapItems, DAYS_BACK);
    } catch (e) {
      logger.warn("Não foi possível acessar o sitemap. Usando o feed/home.");
    }

    // 2) Tenta usar o feed (melhor para buscar dias anteriores)
    let feedItems = [];
    try {
      const feedResponse = await axios.get(FEED_URL, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
        },
      });
      feedItems = extractArticlesFromFeed(feedResponse.data);
      feedItems = filterByDays(feedItems, DAYS_BACK);
    } catch (e) {
      logger.warn("Não foi possível acessar o feed. Usando a home.");
    }

    let articles = sitemapItems.length
      ? sitemapItems
      : feedItems.length
      ? feedItems
      : extractArticlesFromHome($);
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
    let allSummaries = [];
    let resumaoTextos = [];
    for (const article of articles) {
      logger.info(`Processando: ${article.name}`);
      let summary = "";
      try {
        summary = await summarizeUrl(article.url);
      } catch (e) {
        logger.error(`Erro ao resumir notícia (${article.url}):`, e);
        summary = "[ERRO AO RESUMIR]";
      }
      const timestamp = new Date().toISOString();
      let logEntry = `[${timestamp}] ${article.name}\nURL: ${article.url}\nRESUMO: ${summary}\n\n`;
      allSummaries.push(logEntry);
      resumaoTextos.push(`- ${article.name}: ${summary}`);
    }

    // Gera o resumão geral
    let resumao =
      resumaoTextos.length > 0
        ? resumaoTextos.join("\n")
        : "Nenhum resumo gerado.";
    let resumaoEntry = `========== RESUMÃO GERAL ==========\n${resumao}\n===================================\n\n`;

    // Salva todos os resumos e o resumão no log
    try {
      fs.appendFileSync(LOG_FILE, allSummaries.join("") + resumaoEntry);
      logger.success(`Todos os resumos e o resumão salvos em ${LOG_FILE}`);
    } catch (e) {
      logger.error("Erro ao escrever no arquivo de log:", e);
    }
    // Atualiza a última notícia conhecida
    lastKnownTopArticleUrl = articles[0].url;
  } catch (error) {
    logger.error("Ocorreu um erro:", error);
  }
};

checkPageForNews();
setInterval(checkPageForNews, CHECK_INTERVAL_MS);
