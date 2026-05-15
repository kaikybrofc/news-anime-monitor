const { normalizeHost } = require("../utils/url-normalization.js");

const GENERIC_BLOCKLIST = new Set([
  "facebook.com",
  "twitter.com",
  "x.com",
  "instagram.com",
  "tiktok.com",
  "youtube.com",
  "youtu.be",
  "discord.com",
  "discord.gg",
  "reddit.com",
  "linkedin.com",
  "pinterest.com",
  "tumblr.com",
  "wikipedia.org",
  "google.com",
  "bing.com",
  "yahoo.com",
  "cloudflare.com",
  "feedburner.com",
  "wordpress.com",
  "github.com",
]);

const TOPIC_KEYWORDS = [
  "anime",
  "manga",
  "otaku",
  "japan",
  "japanese",
  "game",
  "gaming",
  "videogame",
  "nintendo",
  "playstation",
  "xbox",
  "steam",
  "jrpg",
  "visual-novel",
  "light-novel",
  "vtuber",
  "bandai",
  "square-enix",
  "sega",
  "capcom",
  "atlus",
];

function knownDomainSet(sourceDefinitions = {}) {
  const set = new Set();
  Object.values(sourceDefinitions).forEach((source) => {
    (source?.domains || []).forEach((domain) => {
      const normalized = normalizeHost(domain);
      if (normalized) set.add(normalized);
    });
  });
  return set;
}

function extractUrlsFromText(text = "") {
  const source = String(text || "");
  if (!source) return [];

  const matches = source.match(/https?:\/\/[^\s)>"']+/gi) || [];
  return matches.map((url) => String(url).trim()).filter(Boolean);
}

function extractExternalDomainsFromArticle(article = {}) {
  const refined = article?.refined || {};
  const ownDomain = normalizeHost(refined.domain || "");
  const urlCandidates = new Set();

  (Array.isArray(refined.relatedUrls) ? refined.relatedUrls : []).forEach((url) => {
    if (url) urlCandidates.add(String(url));
  });

  extractUrlsFromText(refined.summary || "").forEach((url) => urlCandidates.add(url));

  const extracted = [];
  urlCandidates.forEach((raw) => {
    try {
      const parsed = new URL(String(raw));
      if (!["http:", "https:"].includes(parsed.protocol)) return;
      const domain = normalizeHost(parsed.hostname);
      if (!domain || (ownDomain && domain === ownDomain)) return;
      extracted.push({
        domain,
        url: parsed.toString(),
        path: String(parsed.pathname || "/").toLowerCase(),
      });
    } catch {
      // Ignore URL inválida.
    }
  });

  return extracted;
}

function containsTopicKeyword(text = "") {
  const normalized = String(text || "").toLowerCase();
  return TOPIC_KEYWORDS.some((keyword) => normalized.includes(keyword));
}

function scoreCandidateReference(reference = {}, article = {}) {
  const refined = article?.refined || {};
  let score = 0;

  if (containsTopicKeyword(reference.domain)) score += 0.26;
  if (containsTopicKeyword(reference.path)) score += 0.24;
  if (containsTopicKeyword(refined.name || "")) score += 0.2;
  if (containsTopicKeyword(refined.summary || "")) score += 0.2;

  const contentType = String(refined.contentType || "").toLowerCase();
  if (contentType === "news") score += 0.08;
  if (contentType === "brief") score += 0.04;

  const normalizedSourceType = String(refined.sourceType || "").toLowerCase();
  if (["feed", "sitemap", "home"].includes(normalizedSourceType)) score += 0.02;

  return Math.min(1, Number(score.toFixed(4)));
}

function looksGenericDomain(domain = "") {
  const normalized = normalizeHost(domain);
  if (!normalized) return true;
  if (GENERIC_BLOCKLIST.has(normalized)) return true;
  return Array.from(GENERIC_BLOCKLIST).some(
    (blocked) => normalized === blocked || normalized.endsWith(`.${blocked}`)
  );
}

function discoverSourceCandidates(
  articles = [],
  sourceDefinitions = {},
  options = {}
) {
  const minConfidence = Number.isFinite(options.minConfidence)
    ? Number(options.minConfidence)
    : 0.35;
  const top = Number.isFinite(options.top) ? Math.max(1, Math.floor(options.top)) : 100;

  const knownDomains = knownDomainSet(sourceDefinitions);
  const candidates = new Map();

  for (const article of articles) {
    const references = extractExternalDomainsFromArticle(article);
    for (const reference of references) {
      const domain = reference.domain;
      if (!domain) continue;
      if (knownDomains.has(domain)) continue;
      if (looksGenericDomain(domain)) continue;

      const refScore = scoreCandidateReference(reference, article);
      if (refScore < 0.08) continue;

      if (!candidates.has(domain)) {
        candidates.set(domain, {
          domain,
          sampleUrls: new Set(),
          referencedByArticleIds: new Set(),
          scores: [],
          keywordHits: 0,
          firstSeenAt: "",
          lastSeenAt: "",
        });
      }

      const row = candidates.get(domain);
      row.sampleUrls.add(reference.url);
      row.referencedByArticleIds.add(String(article?.id || ""));
      row.scores.push(refScore);
      if (containsTopicKeyword(reference.domain) || containsTopicKeyword(reference.path)) {
        row.keywordHits += 1;
      }

      const seenAt = String(
        article?.refined?.lastSeenAt || article?.timestamp || new Date().toISOString()
      );
      if (!row.firstSeenAt || seenAt < row.firstSeenAt) row.firstSeenAt = seenAt;
      if (!row.lastSeenAt || seenAt > row.lastSeenAt) row.lastSeenAt = seenAt;
    }
  }

  const ranked = Array.from(candidates.values())
    .map((row) => {
      const avgScore =
        row.scores.length > 0
          ? row.scores.reduce((sum, value) => sum + value, 0) / row.scores.length
          : 0;
      const frequencyBoost = Math.min(0.25, row.referencedByArticleIds.size * 0.04);
      const keywordBoost = Math.min(0.2, row.keywordHits * 0.03);
      const topicConfidence = Math.min(
        1,
        Number((avgScore + frequencyBoost + keywordBoost).toFixed(4))
      );

      return {
        domain: row.domain,
        topicConfidence,
        referenceCount: row.scores.length,
        uniqueArticles: row.referencedByArticleIds.size,
        firstSeenAt: row.firstSeenAt,
        lastSeenAt: row.lastSeenAt,
        sampleUrls: Array.from(row.sampleUrls).slice(0, 5),
      };
    })
    .filter((row) => row.topicConfidence >= minConfidence)
    .sort((a, b) => {
      if (b.topicConfidence !== a.topicConfidence) {
        return b.topicConfidence - a.topicConfidence;
      }
      if (b.referenceCount !== a.referenceCount) {
        return b.referenceCount - a.referenceCount;
      }
      return a.domain.localeCompare(b.domain);
    })
    .slice(0, top);

  return ranked;
}

module.exports = {
  discoverSourceCandidates,
};
