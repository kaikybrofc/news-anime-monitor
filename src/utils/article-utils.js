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

const DEFAULT_HOME_LINK_SELECTORS = [
  ".entry-title .p-url",
  "article h2.entry-title a",
  "article h2 a",
  "article h3 a",
];

function normalizeHost(hostname) {
  return String(hostname || "")
    .toLowerCase()
    .replace(/^www\./, "");
}

function normalizeUrl(rawUrl, baseUrl = "") {
  try {
    const resolved = baseUrl ? new URL(rawUrl, baseUrl) : new URL(rawUrl);

    if (!["http:", "https:"].includes(resolved.protocol)) {
      return "";
    }

    resolved.hash = "";
    resolved.search = "";
    resolved.hostname = normalizeHost(resolved.hostname);

    return resolved.toString();
  } catch {
    return "";
  }
}

function matchesDomain(hostname, domains) {
  const normalizedHost = normalizeHost(hostname);
  const normalizedDomains = (domains || []).map(normalizeHost);

  if (!normalizedDomains.length) {
    return normalizedHost === "animenew.com.br";
  }

  return normalizedDomains.some(
    (domain) => normalizedHost === domain || normalizedHost.endsWith(`.${domain}`)
  );
}

function isArticleUrl(href, source = {}) {
  if (!href) return false;

  const normalized = normalizeUrl(href, source.monitorUrl);
  if (!normalized) return false;

  try {
    const url = new URL(normalized);

    if (!matchesDomain(url.hostname, source.domains)) return false;

    const pathName = url.pathname || "/";
    if (pathName === "/" || pathName === "") return false;

    const excludedPathPrefixes =
      source.excludedPathPrefixes || EXCLUDED_PATH_PREFIXES;

    if (
      excludedPathPrefixes.some((prefix) =>
        pathName.toLowerCase().startsWith(String(prefix).toLowerCase())
      )
    ) {
      return false;
    }

    const allowedPathPrefixes = source.allowedPathPrefixes || [];
    if (
      allowedPathPrefixes.length &&
      !allowedPathPrefixes.some((prefix) =>
        pathName.toLowerCase().startsWith(String(prefix).toLowerCase())
      )
    ) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

function inferTitleFromUrl(articleUrl) {
  try {
    const normalized = normalizeUrl(articleUrl);
    if (!normalized) return String(articleUrl || "");

    const url = new URL(normalized);
    const segments = url.pathname.split("/").filter(Boolean);
    const slug = decodeURIComponent(segments.pop() || "");

    const cleaned = slug
      .replace(/[-_]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (!cleaned) return normalized;

    return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  } catch {
    return String(articleUrl || "");
  }
}

function normalizeText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractArticlesFromHome($, source = {}) {
  const selectors = Array.isArray(source.homeLinkSelectors)
    ? source.homeLinkSelectors
    : DEFAULT_HOME_LINK_SELECTORS;

  const seen = new Set();
  const items = [];

  selectors.forEach((selector) => {
    $(selector).each((_, el) => {
      const href = $(el).attr("href");
      const normalizedUrl = normalizeUrl(href, source.monitorUrl);
      if (!normalizedUrl) return;
      if (!isArticleUrl(normalizedUrl, source)) return;
      if (seen.has(normalizedUrl)) return;

      const rawTitle =
        normalizeText($(el).text()) ||
        normalizeText($(el).attr("title")) ||
        normalizeText($(el).attr("aria-label"));

      const title = rawTitle || inferTitleFromUrl(normalizedUrl);
      if (!title) return;

      seen.add(normalizedUrl);
      items.push({ name: title, url: normalizedUrl });
    });
  });

  return items;
}

function extractArticlesFromHomeHtml(html, source = {}) {
  const $ = cheerio.load(html);
  return extractArticlesFromHome($, source);
}

function matchesRequiredCategories(categories, requiredCategories) {
  if (!requiredCategories || !requiredCategories.length) {
    return true;
  }

  const categorySet = new Set(categories.map((category) => category.toLowerCase()));

  return requiredCategories.some((required) =>
    categorySet.has(String(required || "").toLowerCase())
  );
}

function extractArticlesFromFeed(xml, source = {}) {
  const $ = cheerio.load(xml, { xmlMode: true });
  const items = [];
  const seen = new Set();

  $("item").each((_, el) => {
    const titleText = normalizeText($(el).find("title").first().text());
    const linkText = normalizeText($(el).find("link").first().text());
    const guidText = normalizeText($(el).find("guid").first().text());
    const pubDate = normalizeText($(el).find("pubDate").first().text());

    const categories = $(el)
      .find("category")
      .map((__, categoryNode) => normalizeText($(categoryNode).text()))
      .get()
      .filter(Boolean);

    const normalizedUrl = normalizeUrl(linkText || guidText, source.monitorUrl);
    if (!normalizedUrl) return;
    if (!isArticleUrl(normalizedUrl, source)) return;
    if (!matchesRequiredCategories(categories, source.requiredFeedCategories)) {
      return;
    }
    if (seen.has(normalizedUrl)) return;

    seen.add(normalizedUrl);
    items.push({
      name: titleText || inferTitleFromUrl(normalizedUrl),
      url: normalizedUrl,
      pubDate,
      categories,
    });
  });

  return items;
}

function extractSitemapsFromIndex(xml) {
  const $ = cheerio.load(xml, { xmlMode: true });
  const items = [];

  $("sitemap > loc").each((_, el) => {
    const loc = normalizeText($(el).text());
    if (loc) items.push(loc);
  });

  return items;
}

function extractUrlsFromSitemap(xml, source = {}) {
  const $ = cheerio.load(xml, { xmlMode: true });
  const items = [];

  $("url").each((_, el) => {
    const loc = normalizeText($(el).find("loc").first().text());
    const lastmod = normalizeText($(el).find("lastmod").first().text());
    const normalizedUrl = normalizeUrl(loc, source.monitorUrl);

    if (!normalizedUrl) return;
    if (!isArticleUrl(normalizedUrl, source)) return;

    items.push({ url: normalizedUrl, lastmod });
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

function escapeRegex(input) {
  return String(input || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stripTitleSuffixes(title, source = {}) {
  const rawSuffixes = [
    ...(source.titleSuffixes || []),
    "AnimeNew",
    "Anime Corner",
  ];

  const uniqueSuffixes = Array.from(
    new Set(rawSuffixes.map((suffix) => normalizeText(suffix)).filter(Boolean))
  );

  let cleaned = normalizeText(title);

  uniqueSuffixes.forEach((suffix) => {
    const escapedSuffix = escapeRegex(suffix);
    cleaned = cleaned
      .replace(new RegExp(`\\s+\\|\\s*${escapedSuffix}\\s*$`, "i"), "")
      .replace(new RegExp(`\\s+-\\s*${escapedSuffix}\\s*$`, "i"), "")
      .trim();
  });

  return cleaned;
}

function extractTitleFromHtml(html, source = {}) {
  const $ = cheerio.load(html);

  const candidates = [
    $('meta[property="og:title"]').attr("content"),
    $('meta[name="twitter:title"]').attr("content"),
    $("h1.entry-title").first().text(),
    $("h1.post-title").first().text(),
    $("article h1").first().text(),
    $("title").first().text(),
  ];

  const rawTitle = candidates.find((value) => normalizeText(value).length > 0);
  if (!rawTitle) return "";

  return stripTitleSuffixes(rawTitle, source);
}

function isLikelyUrl(value) {
  return /^https?:\/\//i.test(String(value || ""));
}

module.exports = {
  EXCLUDED_PATH_PREFIXES,
  normalizeUrl,
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
