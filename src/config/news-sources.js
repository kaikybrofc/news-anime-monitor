const DEFAULT_ANIMENEW_EXCLUDED_PREFIXES = [
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

const DEFAULT_ANIMECORNER_EXCLUDED_PREFIXES = [
  "/category/",
  "/tag/",
  "/author/",
  "/page/",
  "/about-us/",
  "/team/",
  "/contact/",
  "/privacy-policy/",
  "/editorial-policy/",
  "/polls/",
  "/community/",
  "/wp-",
  "/feed/",
];

const DEFAULT_ANN_EXCLUDED_PREFIXES = [
  "/news/archive",
  "/news/rss",
  "/news/atom",
  "/news/encyclopedia",
  "/news/network",
  "/news/topic",
  "/news/tag",
];

function getFirstEnvValue(keys = []) {
  for (const key of keys) {
    const value = String(process.env[key] || "").trim();
    if (value) return value;
  }

  return "";
}

function buildRequestHeaders(baseHeaders = {}, cookieEnvKeys = []) {
  const headers = { ...baseHeaders };
  const cookie = getFirstEnvValue(cookieEnvKeys);

  if (cookie) {
    headers.Cookie = cookie;
  }

  return Object.keys(headers).length ? headers : undefined;
}

const SOURCE_DEFINITIONS = {
  animenew: {
    id: "animenew",
    name: "AnimeNew",
    monitorUrl: "https://animenew.com.br/",
    feedUrl: "https://animenew.com.br/feed/",
    sitemapIndexUrl: "https://animenew.com.br/sitemap_index.xml",
    collectionPriority: ["sitemap", "feed", "home"],
    enableSitemap: true,
    domains: ["animenew.com.br"],
    excludedPathPrefixes: DEFAULT_ANIMENEW_EXCLUDED_PREFIXES,
    homeLinkSelectors: [".entry-title .p-url"],
    titleSuffixes: ["AnimeNew"],
  },
  animecorner: {
    id: "animecorner",
    name: "Anime Corner",
    monitorUrl: "https://animecorner.me/category/news/anime-news/",
    feedUrl: "https://animecorner.me/category/news/anime-news/feed/",
    sitemapIndexUrl: "https://animecorner.me/sitemap_index.xml",
    collectionPriority: ["feed", "home", "sitemap"],
    enableSitemap: false,
    domains: ["animecorner.me"],
    excludedPathPrefixes: DEFAULT_ANIMECORNER_EXCLUDED_PREFIXES,
    homeLinkSelectors: [
      "article.item.hentry h2.penci-entry-title.entry-title a",
      "article.item.hentry h2.entry-title a",
    ],
    requiredFeedCategories: ["Anime News"],
    titleSuffixes: ["Anime Corner"],
  },
  animenewsnetwork: {
    id: "animenewsnetwork",
    name: "Anime News Network",
    monitorUrl: "https://www.animenewsnetwork.com/news",
    feedUrl: "https://www.animenewsnetwork.com/news/rss.xml?ann-edition=w",
    collectionPriority: ["feed", "home"],
    mergeBuckets: true,
    maxItems: 200,
    enableSitemap: false,
    domains: ["animenewsnetwork.com"],
    allowedPathPrefixes: ["/news/", "/daily-briefs/"],
    excludedPathPrefixes: DEFAULT_ANN_EXCLUDED_PREFIXES,
    homeLinkSelectors: [
      ".mainfeed-section .herald.box.news h3 a",
      ".herald.box.news h3 a",
      "a[href^='/news/']",
      "a[href^='/daily-briefs/']",
    ],
    requestHeaders: buildRequestHeaders(
      {
        Referer: "https://www.animenewsnetwork.com/news",
        Origin: "https://www.animenewsnetwork.com",
      },
      ["ANIMENEWSNETWORK_COOKIE", "ANN_COOKIE"]
    ),
    titleSuffixes: ["Anime News Network"],
  },
};

const DEFAULT_SOURCE_IDS = Object.keys(SOURCE_DEFINITIONS);

function parseSourceIds(sourceIdsRaw) {
  if (!sourceIdsRaw || !String(sourceIdsRaw).trim()) {
    return DEFAULT_SOURCE_IDS;
  }

  const parsed = String(sourceIdsRaw)
    .split(",")
    .map((id) => id.trim().toLowerCase())
    .filter(Boolean);

  const uniqueValid = Array.from(
    new Set(parsed.filter((id) => SOURCE_DEFINITIONS[id]))
  );

  return uniqueValid.length ? uniqueValid : DEFAULT_SOURCE_IDS;
}

function getNewsSources() {
  const sourceIds = parseSourceIds(process.env.NEWS_SOURCE_IDS);
  return sourceIds.map((id) => ({ ...SOURCE_DEFINITIONS[id] }));
}

module.exports = {
  SOURCE_DEFINITIONS,
  getNewsSources,
};
