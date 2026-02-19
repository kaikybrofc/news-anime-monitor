const cheerio = require("cheerio");

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

    const pathName = url.pathname || "/";
    if (pathName === "/" || pathName === "") return false;

    return !EXCLUDED_PATH_PREFIXES.some((prefix) =>
      pathName.startsWith(prefix)
    );
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

    if (!isArticleUrl(href) || !title || seen.has(href)) return;

    seen.add(href);
    items.push({ name: title, url: href });
  });

  return items;
}

function extractArticlesFromHomeHtml(html) {
  const $ = cheerio.load(html);
  return extractArticlesFromHome($);
}

function extractArticlesFromFeed(xml) {
  const $ = cheerio.load(xml, { xmlMode: true });
  const items = [];
  const seen = new Set();

  $("item").each((_, el) => {
    const title = $(el).find("title").first().text().trim();
    const link = $(el).find("link").first().text().trim();
    const pubDate = $(el).find("pubDate").first().text().trim();

    if (!link || !title || seen.has(link)) return;

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

    const timestamp = Date.parse(dateStr);
    if (Number.isNaN(timestamp)) return true;

    return now - timestamp <= maxAge;
  });
}

function inferTitleFromUrl(articleUrl) {
  try {
    const url = new URL(articleUrl);
    const segments = url.pathname.split("/").filter(Boolean);
    const slug = decodeURIComponent(segments.pop() || "");

    const cleaned = slug
      .replace(/[-_]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (!cleaned) return articleUrl;

    return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  } catch {
    return articleUrl;
  }
}

function extractTitleFromHtml(html) {
  const $ = cheerio.load(html);

  const candidates = [
    $('meta[property="og:title"]').attr("content"),
    $('meta[name="twitter:title"]').attr("content"),
    $("h1.entry-title").first().text(),
    $("article h1").first().text(),
    $("title").first().text(),
  ];

  const title = candidates.find((value) => value && value.trim().length > 0);
  if (!title) return "";

  return title
    .replace(/\s+\|\s*AnimeNew.*$/i, "")
    .replace(/\s+-\s*AnimeNew.*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isLikelyUrl(value) {
  return /^https?:\/\//i.test(String(value || ""));
}

module.exports = {
  EXCLUDED_PATH_PREFIXES,
  isArticleUrl,
  isLikelyUrl,
  extractArticlesFromHome,
  extractArticlesFromHomeHtml,
  extractArticlesFromFeed,
  extractSitemapsFromIndex,
  extractUrlsFromSitemap,
  filterByDays,
  inferTitleFromUrl,
  extractTitleFromHtml,
};
