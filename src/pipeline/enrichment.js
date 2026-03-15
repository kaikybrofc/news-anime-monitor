const {
  normalizeArticleUrl,
} = require("../utils/url-normalization.js");
const {
  normalizeText,
  normalizeCategories,
  normalizeCategoriesForMatching,
} = require("../utils/category-normalization.js");
const { inferContentType } = require("../utils/content-type.js");
const {
  sha1,
  buildIdentityHash,
  buildContentHash,
  buildContentVersionHash,
} = require("../utils/hashing.js");
const {
  normalizeTitleForMatching,
} = require("./normalization.js");
const { calculateArticleScores } = require("./scoring.js");
const {
  DECISION_STAGES,
  DECISION_EVENTS,
  parseSeenReason,
  buildDecisionEntry,
  appendDecisionTrace,
} = require("./decisioning.js");

function toIsoOrEmpty(value) {
  if (!value) return "";
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return "";
  return new Date(parsed).toISOString();
}

function toPositiveInt(value, fallback = 1) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

function inferSourceFromDomain(domain) {
  const normalizedDomain = String(domain || "").toLowerCase();

  if (
    normalizedDomain === "animenew.com.br" ||
    normalizedDomain.endsWith(".animenew.com.br")
  ) {
    return { sourceId: "animenew", sourceName: "AnimeNew" };
  }

  if (
    normalizedDomain === "animecorner.me" ||
    normalizedDomain.endsWith(".animecorner.me")
  ) {
    return { sourceId: "animecorner", sourceName: "Anime Corner" };
  }

  if (
    normalizedDomain === "animenewsnetwork.com" ||
    normalizedDomain.endsWith(".animenewsnetwork.com")
  ) {
    return { sourceId: "animenewsnetwork", sourceName: "Anime News Network" };
  }

  return { sourceId: "", sourceName: "" };
}

function mergeUniqueStrings(listA = [], listB = []) {
  return Array.from(
    new Set(
      [...listA, ...listB]
        .map((value) => normalizeText(value))
        .filter(Boolean)
    )
  );
}

function buildIdentityHashFromRefined(refined) {
  return buildIdentityHash({
    domain: refined.domain,
    titleNormalized: refined.titleNormalized,
    publishedAt: refined.publishedAt,
  });
}

function ensureRefinedDefaults(refined = {}, nowIso = new Date().toISOString()) {
  const normalizedUrl =
    normalizeArticleUrl(refined.canonicalUrl || refined.url || "") ||
    normalizeArticleUrl(refined.url || "");

  const canonicalUrl =
    normalizedUrl?.canonicalUrl || String(refined.canonicalUrl || refined.url || "");
  const url = normalizedUrl?.url || String(refined.url || canonicalUrl || "");

  const categories = normalizeCategories(refined.categories || []);
  const categoriesNormalized = normalizeCategoriesForMatching(
    Array.isArray(refined.categoriesNormalized) && refined.categoriesNormalized.length
      ? refined.categoriesNormalized
      : categories
  );

  const title = normalizeText(refined.name || "");
  const titleNormalized =
    normalizeText(refined.titleNormalized || "") || normalizeTitleForMatching(title);

  const inferredSource = inferSourceFromDomain(
    refined.domain || normalizedUrl?.hostname || ""
  );

  const sourceId = String(refined.sourceId || inferredSource.sourceId || "");
  const sourceName = String(refined.sourceName || inferredSource.sourceName || "");
  const inferredContentType = inferContentType({
    sourceId,
    canonicalUrl,
    url,
  });
  const currentContentType = String(refined.contentType || "").trim().toLowerCase();
  const publishedAt = toIsoOrEmpty(refined.publishedAt || refined.pubDate);
  const firstSeenAt =
    toIsoOrEmpty(refined.firstSeenAt || refined.createdAt || refined.timestamp) ||
    nowIso;
  const lastSeenAt =
    toIsoOrEmpty(refined.lastSeenAt || refined.updatedAt || refined.timestamp) ||
    firstSeenAt;

  const normalizedRefined = {
    ...refined,
    name: title,
    url,
    canonicalUrl,
    domain: refined.domain || normalizedUrl?.hostname || "",
    pathname: refined.pathname || normalizedUrl?.pathname || "",
    sourceId,
    sourceName,
    sourceType: String(refined.sourceType || "unknown"),
    bucket: String(refined.bucket || "unknown"),
    categories,
    categoriesNormalized,
    titleNormalized,
    contentType:
      currentContentType && currentContentType !== "unknown"
        ? currentContentType
        : inferredContentType || "unknown",
    publishedAt,
    firstSeenAt,
    lastSeenAt,
    timesSeen: toPositiveInt(refined.timesSeen, 1),
    ingestionMeta:
      refined.ingestionMeta && typeof refined.ingestionMeta === "object"
        ? { ...refined.ingestionMeta }
        : {},
    score: Number.isFinite(refined.score) ? Number(refined.score) : 0,
    qualityScore: Number.isFinite(refined.qualityScore)
      ? Number(refined.qualityScore)
      : 0,
    importanceScore: Number.isFinite(refined.importanceScore)
      ? Number(refined.importanceScore)
      : 0,
    trendScore: Number.isFinite(refined.trendScore)
      ? Number(refined.trendScore)
      : 0,
    revisionCount: toPositiveInt(refined.revisionCount, 1),
    lastContentChangeAt: toIsoOrEmpty(refined.lastContentChangeAt) || firstSeenAt,
    lastSeenEvent: String(refined.lastSeenEvent || "new"),
    lastDecision:
      refined.lastDecision && typeof refined.lastDecision === "object"
        ? { ...refined.lastDecision }
        : null,
    decisionTrace: Array.isArray(refined.decisionTrace)
      ? refined.decisionTrace.slice(0, 20)
      : [],
    fetchRestricted: Boolean(
      refined.fetchRestricted || refined?.ingestionMeta?.fetchRestricted
    ),
    topicKey: String(refined.topicKey || ""),
    topicTrendScore: Number.isFinite(refined.topicTrendScore)
      ? Number(refined.topicTrendScore)
      : 0,
    image: String(refined.image || ""),
    summary: String(refined.summary || ""),
    relatedTo: String(refined.relatedTo || ""),
    relatedUrls: Array.isArray(refined.relatedUrls)
      ? refined.relatedUrls
          .map((value) => normalizeText(value))
          .filter(Boolean)
          .slice(0, 20)
      : [],
    weakDuplicateReason: String(refined.weakDuplicateReason || ""),
  };

  normalizedRefined.identityHash =
    String(refined.identityHash || "") || buildIdentityHashFromRefined(normalizedRefined);

  normalizedRefined.contentHash =
    String(refined.contentHash || "") ||
    buildContentHash({
      domain: normalizedRefined.domain,
      titleNormalized: normalizedRefined.titleNormalized,
      summaryNormalized: normalizeText(normalizedRefined.summary),
      publishedAt: normalizedRefined.publishedAt,
    });

  normalizedRefined.contentVersionHash =
    String(refined.contentVersionHash || "") ||
    buildContentVersionHash({
      domain: normalizedRefined.domain,
      canonicalUrl: normalizedRefined.canonicalUrl,
      pathname: normalizedRefined.pathname,
      titleNormalized: normalizedRefined.titleNormalized,
      categoriesNormalized: normalizedRefined.categoriesNormalized,
      contentType: normalizedRefined.contentType,
      image: normalizedRefined.image,
      publishedAt: normalizedRefined.publishedAt,
    });

  const scores = calculateArticleScores(normalizedRefined);
  if (!Number.isFinite(refined.score)) {
    normalizedRefined.score = scores.score;
  }
  if (!Number.isFinite(refined.qualityScore)) {
    normalizedRefined.qualityScore = scores.qualityScore;
  }
  if (!Number.isFinite(refined.importanceScore)) {
    normalizedRefined.importanceScore = scores.importanceScore;
  }
  if (!Number.isFinite(refined.trendScore)) {
    normalizedRefined.trendScore = scores.trendScore;
  }

  return normalizedRefined;
}

function applyArticleDefaults(article, nowIso = new Date().toISOString()) {
  const refined = ensureRefinedDefaults(article?.refined || {}, nowIso);
  const id = String(article?.id || "") || sha1(refined.canonicalUrl || refined.url);

  return {
    ...article,
    id,
    timestamp: toIsoOrEmpty(article?.timestamp) || refined.lastSeenAt || nowIso,
    refined,
  };
}

function buildProcessedArticle({
  candidate,
  name,
  image,
  summary,
  seenAt = new Date().toISOString(),
}) {
  const canonicalUrl = candidate.canonicalUrl || candidate.url;
  const summaryText = String(summary || "");

  const baseRefined = ensureRefinedDefaults(
    {
      name: name || candidate.name,
      url: candidate.url,
      canonicalUrl,
      domain: candidate.domain,
      pathname: candidate.pathname,
      sourceId: candidate.sourceId,
      sourceName: candidate.sourceName,
      sourceType: candidate.sourceType,
      bucket: candidate.bucket,
      categories: candidate.categories,
      categoriesNormalized: candidate.categoriesNormalized,
      titleNormalized: candidate.titleNormalized,
      contentType: inferContentType(candidate),
      publishedAt: candidate.publishedAt,
      firstSeenAt: candidate.firstSeenAt || seenAt,
      lastSeenAt: seenAt,
      timesSeen: candidate.timesSeen || 1,
      image: image || "",
      summary: summaryText,
      ingestionMeta: {
        ...(candidate.ingestionMeta || {}),
      },
      identityHash: candidate.identityHash,
      contentHash: candidate.contentHash,
      contentVersionHash: candidate.contentVersionHash,
      duplicateOf: candidate.duplicateOf || "",
      isWeakDuplicate: Boolean(candidate.isWeakDuplicate),
      relatedTo: candidate.relatedTo || "",
      relatedUrls: Array.isArray(candidate.relatedUrls)
        ? candidate.relatedUrls.slice(0, 20)
        : [],
      weakDuplicateReason: candidate.weakDuplicateReason || "",
      fetchRestricted: Boolean(candidate.fetchRestricted),
      revisionCount: 1,
      lastContentChangeAt: seenAt,
      lastSeenEvent: "new",
      decisionTrace: [],
      lastDecision: null,
      topicKey: String(candidate.topicKey || ""),
      topicTrendScore: Number.isFinite(candidate.topicTrendScore)
        ? Number(candidate.topicTrendScore)
        : 0,
    },
    seenAt
  );

  baseRefined.contentHash = buildContentHash({
    domain: baseRefined.domain,
    titleNormalized: baseRefined.titleNormalized,
    summaryNormalized: normalizeText(summaryText),
    publishedAt: baseRefined.publishedAt,
  });
  baseRefined.contentVersionHash = buildContentVersionHash({
    domain: baseRefined.domain,
    canonicalUrl: baseRefined.canonicalUrl,
    pathname: baseRefined.pathname,
    titleNormalized: baseRefined.titleNormalized,
    categoriesNormalized: baseRefined.categoriesNormalized,
    contentType: baseRefined.contentType,
    image: baseRefined.image,
    publishedAt: baseRefined.publishedAt,
  });

  const scores = calculateArticleScores(baseRefined);
  baseRefined.score = scores.score;
  baseRefined.qualityScore = scores.qualityScore;
  baseRefined.importanceScore = scores.importanceScore;
  baseRefined.trendScore = scores.trendScore;

  const decisionEntry = buildDecisionEntry({
    at: seenAt,
    stage: candidate.fetchRestricted
      ? DECISION_STAGES.FETCH_RESTRICTED
      : DECISION_STAGES.NEW_PROCESSED,
    event: candidate.fetchRestricted
      ? DECISION_EVENTS.FETCH_RESTRICTED
      : DECISION_EVENTS.NEW,
    reason: candidate.fetchRestricted ? "robots_disallowed_fetch" : "new_candidate",
    matchedBy: "",
    fetchRestricted: Boolean(candidate.fetchRestricted),
  });
  baseRefined.lastDecision = decisionEntry;
  baseRefined.decisionTrace = appendDecisionTrace([], decisionEntry, 20);

  const id = sha1(baseRefined.canonicalUrl || baseRefined.url);

  return {
    id,
    timestamp: seenAt,
    refined: baseRefined,
  };
}

function bumpArticleSeen(existingArticle, candidate, reason, seenAt) {
  const nowIso = seenAt || new Date().toISOString();
  const base = applyArticleDefaults(existingArticle, nowIso);
  const candidateSummary = normalizeText(candidate?.summary || "");
  const candidateImage = String(candidate?.image || "").trim();
  const candidateName = normalizeText(candidate?.name || "");
  const candidateTitleNormalized = normalizeTitleForMatching(
    candidate?.titleNormalized || candidateName
  );
  const shouldDetectRevision = String(reason || "").startsWith("post_process");
  const reasonInfo = parseSeenReason(reason);
  const existingContentVersionHash =
    String(base.refined.contentVersionHash || "") ||
    buildContentVersionHash({
      domain: base.refined.domain,
      canonicalUrl: base.refined.canonicalUrl,
      pathname: base.refined.pathname,
      titleNormalized: base.refined.titleNormalized,
      categoriesNormalized: base.refined.categoriesNormalized,
      contentType: base.refined.contentType,
      image: base.refined.image,
      publishedAt: base.refined.publishedAt,
    });
  const candidateContentHash =
    String(candidate?.contentHash || "") ||
    buildContentHash({
      domain: base.refined.domain,
      titleNormalized: candidateTitleNormalized || base.refined.titleNormalized,
      summaryNormalized: candidateSummary,
      publishedAt: candidate?.publishedAt || base.refined.publishedAt,
    });
  const computedCandidateContentVersionHash = buildContentVersionHash({
      domain: candidate?.domain || base.refined.domain,
      canonicalUrl:
        candidate?.canonicalUrl || candidate?.url || base.refined.canonicalUrl,
      pathname: candidate?.pathname || base.refined.pathname,
      titleNormalized:
        candidateTitleNormalized || base.refined.titleNormalized,
      categoriesNormalized:
        Array.isArray(candidate?.categoriesNormalized) &&
        candidate.categoriesNormalized.length
          ? candidate.categoriesNormalized
          : base.refined.categoriesNormalized,
      contentType: candidate?.contentType || base.refined.contentType,
      image: candidateImage || base.refined.image,
      publishedAt: candidate?.publishedAt || base.refined.publishedAt,
    });
  const candidateContentVersionHash =
    computedCandidateContentVersionHash ||
    String(candidate?.contentVersionHash || "");
  const contentChanged =
    shouldDetectRevision &&
    candidateContentVersionHash &&
    candidateContentVersionHash !== existingContentVersionHash;

  const mergedCategories = mergeUniqueStrings(
    base.refined.categories,
    candidate.categories
  );

  const mergedCategoriesNormalized = normalizeCategoriesForMatching(
    mergeUniqueStrings(
      base.refined.categoriesNormalized,
      candidate.categoriesNormalized
    )
  );

  const authContext =
    candidate?.ingestionMeta?.authContext === "logged"
      ? "logged"
      : base.refined?.ingestionMeta?.authContext || "guest";

  base.refined.categories = mergedCategories;
  base.refined.categoriesNormalized = mergedCategoriesNormalized;
  base.refined.lastSeenAt = nowIso;
  base.refined.timesSeen = toPositiveInt(base.refined.timesSeen, 1) + 1;
  base.refined.lastSeenEvent = contentChanged ? "updated" : "revisited";
  if (!base.refined.contentVersionHash && existingContentVersionHash) {
    base.refined.contentVersionHash = existingContentVersionHash;
  }
  if (base.refined.bucket === "unknown" && candidate.bucket) {
    base.refined.bucket = candidate.bucket;
  }
  if (base.refined.sourceType === "unknown" && candidate.sourceType) {
    base.refined.sourceType = candidate.sourceType;
  }
  if (
    (!base.refined.contentType || base.refined.contentType === "unknown") &&
    candidate.contentType
  ) {
    base.refined.contentType = candidate.contentType;
  }

  if (candidate.fetchRestricted) {
    base.refined.fetchRestricted = true;
  }

  if (contentChanged) {
    if (candidateName) {
      base.refined.name = candidateName;
      if (candidateTitleNormalized) {
        base.refined.titleNormalized = candidateTitleNormalized;
      }
    }

    if (candidateSummary) {
      base.refined.summary = candidateSummary;
    }

    if (candidateImage) {
      base.refined.image = candidateImage;
    }

    if (candidate.publishedAt && !Number.isNaN(Date.parse(candidate.publishedAt))) {
      base.refined.publishedAt = new Date(candidate.publishedAt).toISOString();
    }

    if (candidate.contentType) {
      base.refined.contentType = candidate.contentType;
    }

    if (candidateContentHash) {
      base.refined.previousContentHash = base.refined.contentHash || "";
      base.refined.contentHash = candidateContentHash;
    }
    if (candidateContentVersionHash) {
      base.refined.previousContentVersionHash =
        base.refined.contentVersionHash || existingContentVersionHash || "";
      base.refined.contentVersionHash = candidateContentVersionHash;
    }

    base.refined.revisionCount = toPositiveInt(base.refined.revisionCount, 1) + 1;
    base.refined.lastContentChangeAt = nowIso;
  }

  base.refined.ingestionMeta = {
    ...(base.refined.ingestionMeta || {}),
    authContext,
    lastSeenReason: reason,
    lastSeenEvent: contentChanged ? "updated" : "revisited",
    lastSeenBucket: candidate.bucket,
    lastSeenSourceType: candidate.sourceType,
    fetchRestricted: Boolean(base.refined.fetchRestricted),
  };

  const decisionEntry = buildDecisionEntry({
    at: nowIso,
    stage: reasonInfo.stage,
    event: contentChanged ? DECISION_EVENTS.UPDATED : DECISION_EVENTS.REVISITED,
    reason: reasonInfo.reason,
    matchedBy: reasonInfo.matchedBy,
    fetchRestricted: Boolean(base.refined.fetchRestricted),
    duplicateReason: reasonInfo.matchedBy,
  });
  base.refined.lastDecision = decisionEntry;
  base.refined.decisionTrace = appendDecisionTrace(
    base.refined.decisionTrace,
    decisionEntry,
    20
  );

  const scores = calculateArticleScores(base.refined);
  base.refined.score = scores.score;
  base.refined.qualityScore = scores.qualityScore;
  base.refined.importanceScore = scores.importanceScore;
  base.refined.trendScore = scores.trendScore;
  base.timestamp = nowIso;

  return base;
}

module.exports = {
  applyArticleDefaults,
  buildProcessedArticle,
  bumpArticleSeen,
};
