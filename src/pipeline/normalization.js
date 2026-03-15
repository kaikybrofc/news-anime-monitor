const {
  normalizeArticleUrl,
} = require("../utils/url-normalization.js");
const {
  normalizeText,
  normalizeCategories,
  normalizeCategoriesForMatching,
} = require("../utils/category-normalization.js");
const { buildIdentityHash } = require("../utils/hashing.js");
const { buildContentHash } = require("../utils/hashing.js");
const { inferContentType } = require("../utils/content-type.js");

const SOURCE_TYPE_BY_BUCKET = {
  feed: "rss",
  home: "home",
  sitemap: "sitemap",
};

function normalizeTitle(title) {
  return normalizeText(title)
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeTitleForMatching(title) {
  return normalizeTitle(title)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parsePublishedAt(rawDate) {
  if (!rawDate) return "";
  const parsed = Date.parse(rawDate);
  if (Number.isNaN(parsed)) return "";
  return new Date(parsed).toISOString();
}

function inferAuthContext(source) {
  if (source?.id !== "animenewsnetwork") {
    return "guest";
  }

  const hasCookie = Boolean(source?.requestHeaders?.Cookie);
  return hasCookie ? "logged" : "guest";
}

function normalizeCollectedItem(rawItem, source) {
  const normalizedUrl = normalizeArticleUrl(rawItem?.url, {
    baseUrl: source.monitorUrl,
    forceHttps: true,
    keepSearchParams: [],
  });

  if (!normalizedUrl) return null;

  const categories = normalizeCategories(rawItem?.categories || []);
  const categoriesNormalized = normalizeCategoriesForMatching(categories);
  const name = normalizeText(rawItem?.name || "");
  const titleNormalized = normalizeTitleForMatching(name);
  const summaryNormalized = normalizeText(
    rawItem?.summary || rawItem?.description || ""
  );
  const publishedAt = parsePublishedAt(rawItem?.pubDate || rawItem?.lastmod);
  const bucket = rawItem?.bucket || "unknown";
  const sourceType =
    rawItem?.collectedFrom || SOURCE_TYPE_BY_BUCKET[bucket] || "unknown";

  const identityHash = buildIdentityHash({
    domain: normalizedUrl.hostname,
    titleNormalized,
    publishedAt,
  });
  const contentHash = buildContentHash({
    domain: normalizedUrl.hostname,
    titleNormalized,
    summaryNormalized,
    publishedAt,
  });

  const nowIso = new Date().toISOString();

  return {
    ...rawItem,
    sourceId: source.id,
    sourceName: source.name,
    sourceConfig: source,
    url: normalizedUrl.url,
    canonicalUrl: normalizedUrl.canonicalUrl,
    domain: normalizedUrl.hostname,
    pathname: normalizedUrl.pathname,
    name,
    titleNormalized,
    summary: summaryNormalized,
    categories,
    categoriesNormalized,
    bucket,
    sourceType,
    contentType: inferContentType({
      sourceId: source.id,
      canonicalUrl: normalizedUrl.canonicalUrl,
      url: normalizedUrl.url,
    }),
    publishedAt,
    identityHash,
    contentHash,
    firstSeenAt: rawItem?.firstSeenAt || nowIso,
    lastSeenAt: rawItem?.lastSeenAt || nowIso,
    timesSeen: Number(rawItem?.timesSeen || 1),
    ingestionMeta: {
      ...(rawItem?.ingestionMeta || {}),
      source: source.id,
      bucket,
      collectedFrom: sourceType,
      authContext: inferAuthContext(source),
    },
  };
}

function normalizeCollectedItems(items, source) {
  return items
    .map((item) => normalizeCollectedItem(item, source))
    .filter(Boolean);
}

module.exports = {
  normalizeCollectedItem,
  normalizeCollectedItems,
  normalizeTitle,
  normalizeTitleForMatching,
};
