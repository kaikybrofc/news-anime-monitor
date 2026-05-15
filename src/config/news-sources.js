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
  gematsu: {
    id: "gematsu",
    name: "Gematsu",
    monitorUrl: "https://www.gematsu.com/",
    feedUrl: "https://www.gematsu.com/feed",
    collectionPriority: ["feed", "home"],
    enableSitemap: false,
    domains: ["gematsu.com"],
    excludedPathPrefixes: ["/about", "/contact", "/privacy", "/tag/", "/page/"],
    homeLinkSelectors: [
      "article h2 a",
      ".post h2 a",
      "a[href*='/20']",
    ],
    titleSuffixes: ["Gematsu"],
  },
  nintendolife: {
    id: "nintendolife",
    name: "Nintendo Life",
    monitorUrl: "https://www.nintendolife.com/news",
    collectionPriority: ["home"],
    enableSitemap: false,
    domains: ["nintendolife.com"],
    allowedPathPrefixes: ["/news/"],
    excludedPathPrefixes: ["/reviews/", "/guides/", "/features/", "/videos/", "/forums/"],
    homeLinkSelectors: ["a[href^='/news/']"],
    titleSuffixes: ["Nintendo Life"],
  },
  pcgamer: {
    id: "pcgamer",
    name: "PC Gamer",
    monitorUrl: "https://www.pcgamer.com/gaming-industry/",
    feedUrl: "https://www.pcgamer.com/rss/",
    collectionPriority: ["feed", "home"],
    enableSitemap: false,
    domains: ["pcgamer.com"],
    allowedPathPrefixes: ["/games/", "/gaming-industry/", "/hardware/"],
    excludedPathPrefixes: ["/deals/", "/how-to/", "/features/", "/reviews/"],
    homeLinkSelectors: ["a[href^='/games/']", "a[href^='/gaming-industry/']"],
    titleSuffixes: ["PC Gamer"],
  },
  eurogamer: {
    id: "eurogamer",
    name: "Eurogamer",
    monitorUrl: "https://www.eurogamer.net/",
    collectionPriority: ["home"],
    enableSitemap: false,
    domains: ["eurogamer.net"],
    allowedPathPrefixes: ["/news/", "/features/"],
    excludedPathPrefixes: ["/guides/", "/reviews/"],
    homeLinkSelectors: ["a[href^='/news/']"],
    titleSuffixes: ["Eurogamer"],
  },
  rockpapershotgun: {
    id: "rockpapershotgun",
    name: "Rock Paper Shotgun",
    monitorUrl: "https://www.rockpapershotgun.com/news",
    feedUrl: "https://www.rockpapershotgun.com/feed/news",
    collectionPriority: ["feed", "home"],
    enableSitemap: false,
    domains: ["rockpapershotgun.com"],
    allowedPathPrefixes: ["/", "/news/"],
    excludedPathPrefixes: ["/guides/", "/reviews/", "/deals/"],
    homeLinkSelectors: ["article h2 a", "a[href*='rockpapershotgun.com/']"],
    titleSuffixes: ["Rock Paper Shotgun"],
  },
  igngames: {
    id: "igngames",
    name: "IGN Games",
    monitorUrl: "https://www.ign.com/games",
    feedUrl: "https://www.ign.com/rss/articles/feed",
    collectionPriority: ["feed", "home"],
    enableSitemap: false,
    domains: ["ign.com"],
    allowedPathPrefixes: ["/articles/", "/news/"],
    excludedPathPrefixes: ["/videos/", "/wikis/", "/podcasts/"],
    homeLinkSelectors: ["a[href^='/articles/']", "a[href^='/news/']"],
    titleSuffixes: ["IGN"],
  },
  gamespot: {
    id: "gamespot",
    name: "GameSpot",
    monitorUrl: "https://www.gamespot.com/news/",
    feedUrl: "https://www.gamespot.com/feeds/mashup/",
    collectionPriority: ["feed", "home"],
    enableSitemap: false,
    domains: ["gamespot.com"],
    allowedPathPrefixes: ["/articles/", "/news/"],
    excludedPathPrefixes: ["/reviews/", "/guides/", "/videos/"],
    homeLinkSelectors: ["a[href^='/articles/']", "a[href^='/news/']"],
    titleSuffixes: ["GameSpot"],
  },
  aftermath: {
    id: "aftermath",
    name: "Aftermath",
    monitorUrl: "https://aftermath.site/",
    collectionPriority: ["home"],
    enableSitemap: false,
    domains: ["aftermath.site"],
    excludedPathPrefixes: ["/about", "/contact", "/privacy", "/tag/"],
    homeLinkSelectors: ["article h2 a", "a[href*='aftermath.site/']"],
    titleSuffixes: ["Aftermath"],
  },
  kakuchopurei: {
    id: "kakuchopurei",
    name: "Kakuchopurei",
    monitorUrl: "https://www.kakuchopurei.com/",
    feedUrl: "https://www.kakuchopurei.com/feed/",
    collectionPriority: ["feed", "home"],
    enableSitemap: false,
    domains: ["kakuchopurei.com"],
    excludedPathPrefixes: DEFAULT_WORDPRESS_EXCLUDED_PREFIXES,
    homeLinkSelectors: ["article h2 a", "h2.entry-title a", "a[rel='bookmark']"],
    titleSuffixes: ["Kakuchopurei"],
  },
  kongbakpao: {
    id: "kongbakpao",
    name: "Kongbakpao",
    monitorUrl: "https://www.kongbakpao.com/",
    feedUrl: "https://www.kongbakpao.com/feed/",
    collectionPriority: ["feed", "home"],
    enableSitemap: false,
    domains: ["kongbakpao.com"],
    excludedPathPrefixes: DEFAULT_WORDPRESS_EXCLUDED_PREFIXES,
    homeLinkSelectors: ["article h2 a", "h2.entry-title a", "a[rel='bookmark']"],
    titleSuffixes: ["Kongbakpao"],
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
