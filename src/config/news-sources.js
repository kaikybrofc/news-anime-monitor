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
