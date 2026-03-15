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
  buildInventoryMetrics,
};
