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
  let velocityScore = 0;

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
    qualityScore -= 10;
  }

  if (isGenericTitle(article.titleNormalized)) {
    qualityScore -= 15;
  }

  const topicTrend = Number(article.topicTrendScore || 0);
  if (Number.isFinite(topicTrend) && topicTrend > 0) {
    trendScore += Math.min(30, topicTrend);
  }

  const timesSeen = Number(article.timesSeen || 0);
  if (Number.isFinite(timesSeen) && timesSeen > 1) {
    velocityScore += Math.min(12, (timesSeen - 1) * 2);
  }

  const firstSeenTs = Date.parse(String(article.firstSeenAt || ""));
  const lastSeenTs = Date.parse(String(article.lastSeenAt || ""));
  if (!Number.isNaN(firstSeenTs) && !Number.isNaN(lastSeenTs) && lastSeenTs >= firstSeenTs) {
    const ageHours = (lastSeenTs - firstSeenTs) / (1000 * 60 * 60);
    if (ageHours <= 24) velocityScore += 6;
    else if (ageHours <= 48) velocityScore += 4;
    else if (ageHours <= 72) velocityScore += 2;
  }

  velocityScore = Math.max(0, Math.min(20, velocityScore));

  if (article.fetchRestricted) {
    qualityScore -= 10;
  }

  const score = qualityScore + importanceScore + trendScore + velocityScore;

  return {
    score,
    qualityScore,
    importanceScore,
    trendScore,
    velocityScore,
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
