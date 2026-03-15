function toTimestamp(candidate = {}) {
  const value = candidate.publishedAt || candidate.pubDate || candidate.lastmod;
  if (!value) return 0;

  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function tokenizeTitle(title = "") {
  return String(title || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 4);
}

function computeJaccardSimilarity(aTokens = [], bTokens = []) {
  const a = new Set(aTokens);
  const b = new Set(bTokens);

  if (!a.size || !b.size) return 0;

  let intersection = 0;
  a.forEach((token) => {
    if (b.has(token)) intersection += 1;
  });

  const union = a.size + b.size - intersection;
  return union > 0 ? intersection / union : 0;
}

function isCrossSourceWeakDuplicate(candidate, original) {
  if (!candidate?.titleNormalized || !original?.titleNormalized) {
    return false;
  }

  const similarity = computeJaccardSimilarity(
    tokenizeTitle(candidate.titleNormalized),
    tokenizeTitle(original.titleNormalized)
  );

  if (similarity < 0.72) {
    return false;
  }

  const candidateTs = toTimestamp(candidate);
  const originalTs = toTimestamp(original);

  if (!candidateTs || !originalTs) {
    return similarity >= 0.84;
  }

  const twoDaysMs = 2 * 24 * 60 * 60 * 1000;
  return Math.abs(candidateTs - originalTs) <= twoDaysMs;
}

function dedupeCandidates(candidates = []) {
  const accepted = [];
  const duplicates = [];

  const canonicalMap = new Map();
  const sourceTitleMap = new Map();
  const sourceContentHashMap = new Map();
  const sourceIdentityMap = new Map();
  const globalTitleMap = new Map();
  const globalContentHashMap = new Map();
  const globalIdentityMap = new Map();

  for (const candidate of candidates) {
    const canonicalKey = String(candidate.canonicalUrl || "");
    const sourceTitleKey = `${candidate.sourceId || ""}|${
      candidate.titleNormalized || ""
    }`;
    const sourceContentHashKey = `${candidate.sourceId || ""}|${
      candidate.contentHash || ""
    }`;
    const sourceIdentityKey = `${candidate.sourceId || ""}|${
      candidate.identityHash || ""
    }`;

    if (canonicalKey && canonicalMap.has(canonicalKey)) {
      const original = canonicalMap.get(canonicalKey);
      duplicates.push({
        ...candidate,
        duplicateReason: "canonicalUrl",
        duplicateOf: original.canonicalUrl || original.url,
      });
      continue;
    }

    if (candidate.titleNormalized && sourceTitleMap.has(sourceTitleKey)) {
      const original = sourceTitleMap.get(sourceTitleKey);
      duplicates.push({
        ...candidate,
        duplicateReason: "titleNormalized",
        duplicateOf: original.canonicalUrl || original.url,
      });
      continue;
    }

    if (candidate.contentHash && sourceContentHashMap.has(sourceContentHashKey)) {
      const original = sourceContentHashMap.get(sourceContentHashKey);
      duplicates.push({
        ...candidate,
        duplicateReason: "contentHash",
        duplicateOf: original.canonicalUrl || original.url,
      });
      continue;
    }

    if (candidate.identityHash && sourceIdentityMap.has(sourceIdentityKey)) {
      const original = sourceIdentityMap.get(sourceIdentityKey);
      duplicates.push({
        ...candidate,
        duplicateReason: "identityHash",
        duplicateOf: original.canonicalUrl || original.url,
      });
      continue;
    }

    let isWeakDuplicate = false;
    let weakDuplicateOf = "";

    if (candidate.titleNormalized && globalTitleMap.has(candidate.titleNormalized)) {
      const original = globalTitleMap.get(candidate.titleNormalized);
      if (original.sourceId !== candidate.sourceId) {
        isWeakDuplicate = true;
        weakDuplicateOf = original.canonicalUrl || original.url;
      }
    }

    if (
      !isWeakDuplicate &&
      candidate.contentHash &&
      globalContentHashMap.has(candidate.contentHash)
    ) {
      const original = globalContentHashMap.get(candidate.contentHash);
      if (original.sourceId !== candidate.sourceId) {
        isWeakDuplicate = true;
        weakDuplicateOf = original.canonicalUrl || original.url;
      }
    }

    if (!isWeakDuplicate && candidate.identityHash && globalIdentityMap.has(candidate.identityHash)) {
      const original = globalIdentityMap.get(candidate.identityHash);
      if (original.sourceId !== candidate.sourceId) {
        isWeakDuplicate = true;
        weakDuplicateOf = original.canonicalUrl || original.url;
      }
    }

    if (!isWeakDuplicate) {
      const crossSourceCandidate = accepted.find(
        (item) =>
          item.sourceId &&
          candidate.sourceId &&
          item.sourceId !== candidate.sourceId &&
          isCrossSourceWeakDuplicate(candidate, item)
      );

      if (crossSourceCandidate) {
        isWeakDuplicate = true;
        weakDuplicateOf =
          crossSourceCandidate.canonicalUrl || crossSourceCandidate.url;
      }
    }

    const acceptedItem = {
      ...candidate,
      isWeakDuplicate,
      duplicateOf: isWeakDuplicate ? weakDuplicateOf : "",
    };

    accepted.push(acceptedItem);

    if (canonicalKey) canonicalMap.set(canonicalKey, acceptedItem);
    if (candidate.titleNormalized) {
      sourceTitleMap.set(sourceTitleKey, acceptedItem);
      if (!globalTitleMap.has(candidate.titleNormalized)) {
        globalTitleMap.set(candidate.titleNormalized, acceptedItem);
      }
    }
    if (candidate.contentHash) {
      sourceContentHashMap.set(sourceContentHashKey, acceptedItem);
      if (!globalContentHashMap.has(candidate.contentHash)) {
        globalContentHashMap.set(candidate.contentHash, acceptedItem);
      }
    }
    if (candidate.identityHash) {
      sourceIdentityMap.set(sourceIdentityKey, acceptedItem);
      if (!globalIdentityMap.has(candidate.identityHash)) {
        globalIdentityMap.set(candidate.identityHash, acceptedItem);
      }
    }
  }

  return { accepted, duplicates };
}

function buildExistingArticleIndex(articles = []) {
  const canonicalMap = new Map();
  const contentHashBySource = new Map();
  const identityBySource = new Map();
  const titleBySource = new Map();

  for (const article of articles) {
    const refined = article?.refined || {};
    const canonical = String(refined.canonicalUrl || refined.url || "");
    const sourceId = String(refined.sourceId || "");

    if (canonical) {
      canonicalMap.set(canonical, article);
    }

    if (sourceId && refined.contentHash) {
      contentHashBySource.set(`${sourceId}|${refined.contentHash}`, article);
    }

    if (sourceId && refined.identityHash) {
      identityBySource.set(`${sourceId}|${refined.identityHash}`, article);
    }

    if (sourceId && refined.titleNormalized) {
      titleBySource.set(`${sourceId}|${refined.titleNormalized}`, article);
    }
  }

  return {
    canonicalMap,
    contentHashBySource,
    identityBySource,
    titleBySource,
  };
}

function indexArticle(indexes, article) {
  const refined = article?.refined || {};
  const sourceId = String(refined.sourceId || "");
  const canonical = String(refined.canonicalUrl || refined.url || "");

  if (canonical) indexes.canonicalMap.set(canonical, article);
  if (sourceId && refined.contentHash) {
    indexes.contentHashBySource.set(`${sourceId}|${refined.contentHash}`, article);
  }
  if (sourceId && refined.identityHash) {
    indexes.identityBySource.set(`${sourceId}|${refined.identityHash}`, article);
  }
  if (sourceId && refined.titleNormalized) {
    indexes.titleBySource.set(`${sourceId}|${refined.titleNormalized}`, article);
  }
}

function matchCandidateToExisting(candidate, indexes, options = {}) {
  const {
    allowTitleFallback = true,
    allowContentHash = true,
  } = options;

  const canonical = String(candidate.canonicalUrl || candidate.url || "");
  const sourceId = String(candidate.sourceId || "");

  if (canonical && indexes.canonicalMap.has(canonical)) {
    return {
      article: indexes.canonicalMap.get(canonical),
      reason: "canonicalUrl",
    };
  }

  if (allowContentHash && sourceId && candidate.contentHash) {
    const key = `${sourceId}|${candidate.contentHash}`;
    if (indexes.contentHashBySource.has(key)) {
      return {
        article: indexes.contentHashBySource.get(key),
        reason: "contentHash",
      };
    }
  }

  if (sourceId && candidate.identityHash) {
    const key = `${sourceId}|${candidate.identityHash}`;
    if (indexes.identityBySource.has(key)) {
      return {
        article: indexes.identityBySource.get(key),
        reason: "identityHash",
      };
    }
  }

  if (allowTitleFallback && sourceId && candidate.titleNormalized) {
    const key = `${sourceId}|${candidate.titleNormalized}`;
    if (indexes.titleBySource.has(key)) {
      return {
        article: indexes.titleBySource.get(key),
        reason: "titleNormalized",
      };
    }
  }

  return null;
}

module.exports = {
  dedupeCandidates,
  buildExistingArticleIndex,
  matchCandidateToExisting,
  indexArticle,
};
