const { calculateArticleScores } = require("../pipeline/scoring.js");

function createSourceMetricsTracker(metricsList) {
  const indexBySource = new Map(
    metricsList.map((metrics, index) => [metrics.source, index])
  );

  function updateSourceMetrics(sourceId, updater) {
    const index = indexBySource.get(sourceId);
    if (index === undefined) return;
    updater(metricsList[index]);
  }

  return {
    incrementDuplicate(sourceId, count = 1) {
      updateSourceMetrics(sourceId, (metrics) => {
        metrics.duplicateCount += count;
      });
    },
    incrementNew(sourceId, count = 1) {
      updateSourceMetrics(sourceId, (metrics) => {
        metrics.newCount += count;
      });
    },
    incrementRevisited(sourceId, count = 1) {
      updateSourceMetrics(sourceId, (metrics) => {
        metrics.revisitedCount += count;
      });
    },
    incrementUpdated(sourceId, count = 1) {
      updateSourceMetrics(sourceId, (metrics) => {
        metrics.updatedCount += count;
      });
    },
    incrementFetchRestricted(sourceId, count = 1) {
      updateSourceMetrics(sourceId, (metrics) => {
        metrics.fetchRestrictedCount += count;
      });
    },
    incrementSummaryRetry(sourceId, count = 1) {
      updateSourceMetrics(sourceId, (metrics) => {
        metrics.summaryRetryCount += count;
      });
    },
  };
}

const TOPIC_STOPWORDS = new Set([
  "anime",
  "news",
  "trailer",
  "teaser",
  "visual",
  "announces",
  "announce",
  "reveals",
  "reveal",
  "update",
  "updates",
  "official",
  "episode",
  "season",
  "movie",
  "film",
  "tv",
  "new",
]);

function tokenizeTopic(title = "") {
  return String(title || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 4 && !TOPIC_STOPWORDS.has(token));
}

function deriveTopicKey(refined = {}) {
  const tokens = tokenizeTopic(refined.titleNormalized || refined.name || "");
  const coreTokens = tokens.slice(0, 3);
  if (!coreTokens.length) return "";

  const type = String(refined.contentType || "unknown");
  const source = String(refined.sourceId || "unknown");
  return `${type}|${coreTokens.join("-")}|${source}`;
}

function parseTimestamp(value) {
  const parsed = Date.parse(String(value || ""));
  return Number.isNaN(parsed) ? 0 : parsed;
}

function applyTopicTrendScores(
  articles = [],
  options = {}
) {
  const windowHours = Number.isFinite(options.windowHours)
    ? Number(options.windowHours)
    : 72;
  const maxTrendScore = Number.isFinite(options.maxTrendScore)
    ? Number(options.maxTrendScore)
    : 30;

  const now = Date.now();
  const windowMs = Math.max(1, windowHours) * 60 * 60 * 1000;
  const topicGroups = new Map();

  for (const article of articles) {
    const refined = article?.refined || {};
    const topicKey = deriveTopicKey(refined);
    if (!topicKey) continue;

    const lastSeenTs = parseTimestamp(refined.lastSeenAt || article.timestamp);
    if (!lastSeenTs || now - lastSeenTs > windowMs) {
      continue;
    }

    if (!topicGroups.has(topicKey)) {
      topicGroups.set(topicKey, {
        items: [],
        sourceSet: new Set(),
        latestTs: 0,
      });
    }

    const group = topicGroups.get(topicKey);
    group.items.push(article);
    group.sourceSet.add(String(refined.sourceId || "unknown"));
    group.latestTs = Math.max(group.latestTs, lastSeenTs);
  }

  const topicScoreMap = new Map();
  topicGroups.forEach((group, topicKey) => {
    const frequency = group.items.length;
    const sourceDiversity = group.sourceSet.size;
    const recencyHours = Math.max(0, (now - group.latestTs) / (60 * 60 * 1000));
    const recencyBoost = Math.max(0, 6 - Math.floor(recencyHours / 6));
    const raw = frequency * 3 + sourceDiversity * 4 + recencyBoost;
    topicScoreMap.set(topicKey, Math.min(maxTrendScore, raw));
  });

  for (const article of articles) {
    const refined = article?.refined || {};
    const topicKey = deriveTopicKey(refined);
    const topicTrendScore = topicScoreMap.get(topicKey) || 0;

    refined.topicKey = topicKey;
    refined.topicTrendScore = topicTrendScore;

    const scores = calculateArticleScores(refined);
    refined.score = scores.score;
    refined.qualityScore = scores.qualityScore;
    refined.importanceScore = scores.importanceScore;
    refined.trendScore = scores.trendScore;
    refined.velocityScore = scores.velocityScore;
  }

  return {
    topicsTracked: topicScoreMap.size,
  };
}

function incrementCounter(map, key, count = 1) {
  const normalizedKey = String(key || "unknown");
  map[normalizedKey] = (map[normalizedKey] || 0) + count;
}

function buildInventoryMetrics(articles = []) {
  const summary = {
    totalArticles: articles.length,
    restrictedFetchCount: 0,
    byBucket: {
      feed: 0,
      home: 0,
      sitemap: 0,
      unknown: 0,
    },
    byContentType: {},
    bySource: {},
    lifecycle: {
      new: 0,
      revisited: 0,
      updated: 0,
      unknown: 0,
    },
  };

  for (const article of articles) {
    const refined = article?.refined || {};
    const sourceId = String(refined.sourceId || "unknown");
    const bucket = String(refined.bucket || "unknown");
    const contentType = String(refined.contentType || "unknown");
    const lastSeenEvent = String(refined.lastSeenEvent || "unknown");

    if (!summary.bySource[sourceId]) {
      summary.bySource[sourceId] = {
        total: 0,
        byBucket: {},
        byContentType: {},
        lifecycle: {
          new: 0,
          revisited: 0,
          updated: 0,
          unknown: 0,
        },
      };
    }

    const sourceSummary = summary.bySource[sourceId];
    sourceSummary.total += 1;

    incrementCounter(summary.byBucket, bucket);
    incrementCounter(summary.byContentType, contentType);
    incrementCounter(summary.lifecycle, lastSeenEvent);
    incrementCounter(sourceSummary.byBucket, bucket);
    incrementCounter(sourceSummary.byContentType, contentType);
    incrementCounter(sourceSummary.lifecycle, lastSeenEvent);

    if (refined.fetchRestricted || refined?.ingestionMeta?.fetchRestricted) {
      summary.restrictedFetchCount += 1;
    }
  }

  return summary;
}

module.exports = {
  createSourceMetricsTracker,
  applyTopicTrendScores,
  buildInventoryMetrics,
};
