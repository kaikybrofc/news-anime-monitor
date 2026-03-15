function isGenericTitle(titleNormalized = "") {
  const normalized = String(titleNormalized || "")
    .toLowerCase()
    .trim();

  if (!normalized) return true;

  const genericTitles = new Set([
    "anime news",
    "news",
    "update",
    "announcement",
    "new trailer",
    "new visual",
  ]);

  if (genericTitles.has(normalized)) return true;

  const tokens = normalized.split(/\s+/).filter(Boolean);
  return tokens.length < 4;
}

function calculateArticleScores(article = {}) {
  let qualityScore = 0;
  let importanceScore = 0;
  let trendScore = 0;

  if (article.bucket === "feed") qualityScore += 30;
  if (article.bucket === "sitemap") qualityScore += 20;
  if (article.bucket === "home") qualityScore += 15;

  if (Array.isArray(article.categoriesNormalized) && article.categoriesNormalized.length) {
    qualityScore += 20;
    importanceScore += 6;
  } else {
    qualityScore -= 20;
  }

  if (article.publishedAt && !Number.isNaN(Date.parse(article.publishedAt))) {
    qualityScore += 10;
    importanceScore += 4;
  }

  if (article.contentType && article.contentType !== "unknown") {
    qualityScore += 10;
  }

  if (article.contentType === "news") {
    importanceScore += 8;
  }

  if (article.contentType === "brief") {
    importanceScore += 4;
  }

  if (article.image) {
    qualityScore += 10;
  }

  if (article.isWeakDuplicate) {
    qualityScore -= 25;
    trendScore += 4;
  }

  if (isGenericTitle(article.titleNormalized)) {
    qualityScore -= 15;
  }

  if (Number(article.timesSeen || 1) > 1) {
    trendScore += Math.min(20, Number(article.timesSeen || 1) * 2);
  }

  if (article.revisionCount && Number(article.revisionCount) > 1) {
    trendScore += Math.min(12, Number(article.revisionCount) * 2);
  }

  if (article.fetchRestricted) {
    qualityScore -= 10;
  }

  const score = qualityScore + importanceScore + trendScore;

  return {
    score,
    qualityScore,
    importanceScore,
    trendScore,
  };
}

function calculateArticleScore(article = {}) {
  return calculateArticleScores(article).score;
}

module.exports = {
  calculateArticleScore,
  calculateArticleScores,
  isGenericTitle,
};
