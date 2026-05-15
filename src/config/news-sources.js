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

const DEFAULT_WORDPRESS_EXCLUDED_PREFIXES = [
  "/category/",
  "/tag/",
  "/author/",
  "/page/",
  "/wp-",
  "/feed/",
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
    enforceCategoryScopeAcrossBuckets: true,
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
  crunchyrollnews: {
    id: "crunchyrollnews",
    name: "Crunchyroll News",
    monitorUrl: "https://www.crunchyroll.com/news/",
    collectionPriority: ["home"],
    enableSitemap: false,
    domains: ["crunchyroll.com"],
    allowedPathPrefixes: ["/news/"],
    excludedPathPrefixes: ["/newsrss", "/news/feed"],
    suppressZeroFetchAlert: true,
    homeLinkSelectors: [
      "a[href^='/news/']",
      "a[href*='://www.crunchyroll.com/news/']",
    ],
    titleSuffixes: ["Crunchyroll News", "Crunchyroll"],
  },
  myanimelist: {
    id: "myanimelist",
    name: "MyAnimeList News",
    monitorUrl: "https://myanimelist.net/news",
    feedUrl: "https://myanimelist.net/rss/news.xml",
    collectionPriority: ["feed", "home"],
    mergeBuckets: true,
    maxItems: 200,
    enableSitemap: false,
    domains: ["myanimelist.net"],
    allowedPathPrefixes: ["/news/"],
    excludedPathPrefixes: ["/news/archive", "/news/tag", "/news/featured"],
    homeLinkSelectors: ["a[href^='/news/']"],
    titleSuffixes: ["MyAnimeList"],
  },
  anitrendz: {
    id: "anitrendz",
    name: "Anime Trending",
    monitorUrl: "https://anitrendz.net/news/",
    feedUrl: "https://anitrendz.net/news/feed/",
    sitemapIndexUrl: "https://anitrendz.net/sitemap_index.xml",
    collectionPriority: ["feed", "home", "sitemap"],
    enableSitemap: false,
    domains: ["anitrendz.net"],
    allowedPathPrefixes: ["/news/"],
    excludedPathPrefixes: DEFAULT_WORDPRESS_EXCLUDED_PREFIXES,
    homeLinkSelectors: [
      "article h2 a",
      "h2.entry-title a",
      "a[rel='bookmark']",
      "a[href*='/news/']",
    ],
    titleSuffixes: ["Anime Trending"],
  },
  otakuusa: {
    id: "otakuusa",
    name: "Otaku USA",
    monitorUrl: "https://otakuusamagazine.com/",
    feedUrl: "https://otakuusamagazine.com/feed/",
    sitemapIndexUrl: "https://otakuusamagazine.com/sitemap_index.xml",
    collectionPriority: ["feed", "home", "sitemap"],
    daysBack: 3650,
    enableSitemap: false,
    domains: ["otakuusamagazine.com"],
    excludedPathPrefixes: DEFAULT_WORDPRESS_EXCLUDED_PREFIXES,
    homeLinkSelectors: [
      "article h2 a",
      "article h3 a",
      "a[href*='otakuusamagazine.com/20']",
      "h2.entry-title a",
      "a[rel='bookmark']",
    ],
    titleSuffixes: ["Otaku USA"],
  },
  animeherald: {
    id: "animeherald",
    name: "Anime Herald",
    monitorUrl: "https://www.animeherald.com/",
    feedUrl: "https://www.animeherald.com/feed/",
    sitemapIndexUrl: "https://www.animeherald.com/sitemap_index.xml",
    collectionPriority: ["feed", "home", "sitemap"],
    daysBack: 30,
    enableSitemap: false,
    domains: ["animeherald.com"],
    excludedPathPrefixes: DEFAULT_WORDPRESS_EXCLUDED_PREFIXES,
    homeLinkSelectors: [
      "article h2 a",
      "article h3 a",
      "a[href*='animeherald.com/20']",
      "h2.entry-title a",
      "a[rel='bookmark']",
    ],
    titleSuffixes: ["Anime Herald"],
  },
  animeuknews: {
    id: "animeuknews",
    name: "Anime UK News",
    monitorUrl: "https://animeuknews.net/",
    feedUrl: "https://animeuknews.net/feed/",
    sitemapIndexUrl: "https://animeuknews.net/sitemap_index.xml",
    collectionPriority: ["feed", "home", "sitemap"],
    enableSitemap: false,
    domains: ["animeuknews.net"],
    excludedPathPrefixes: DEFAULT_WORDPRESS_EXCLUDED_PREFIXES,
    homeLinkSelectors: [
      "article h2 a",
      "h2.entry-title a",
      "a[rel='bookmark']",
    ],
    titleSuffixes: ["Anime UK News"],
  },
  otakunews: {
    id: "otakunews",
    name: "Otaku News",
    monitorUrl: "https://www.otakunews.com/",
    feedUrl: "https://www.otakunews.com/rss/rss.xml",
    collectionPriority: ["feed", "home"],
    enableSitemap: false,
    domains: ["otakunews.com"],
    allowedPathPrefixes: ["/Article/", "/Ar/Article/"],
    excludedPathPrefixes: ["/Rss", "/rss/"],
    homeLinkSelectors: ["a[href*='/Article/']", "a[href*='/Ar/Article/']"],
    titleSuffixes: ["Otaku News"],
  },
  siliconera: {
    id: "siliconera",
    name: "Siliconera",
    monitorUrl: "https://www.siliconera.com/",
    feedUrl: "https://www.siliconera.com/feed/",
    sitemapIndexUrl: "https://www.siliconera.com/sitemap_index.xml",
    collectionPriority: ["feed", "home", "sitemap"],
    enableSitemap: false,
    domains: ["siliconera.com"],
    excludedPathPrefixes: DEFAULT_WORDPRESS_EXCLUDED_PREFIXES,
    homeLinkSelectors: [
      "article h2 a",
      "h2.entry-title a",
      "a[rel='bookmark']",
    ],
    titleSuffixes: ["Siliconera"],
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
