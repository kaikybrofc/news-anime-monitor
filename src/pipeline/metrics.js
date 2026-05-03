function createSourceMetrics(source) {
  return {
    source: source.id,
    sourceName: source.name,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    durationMs: 0,
    fetchedCount: 0,
    acceptedCount: 0,
    rejectedCount: 0,
    duplicateCount: 0,
    newCount: 0,
    revisitedCount: 0,
    updatedCount: 0,
    parseErrorCount: 0,
    summaryRetryCount: 0,
    emptyCategoryCount: 0,
    fetchRestrictedCount: 0,
    requiredScopeCategoryRejectCount: 0,
    byBucket: {
      feed: 0,
      home: 0,
      sitemap: 0,
    },
    acceptedByBucket: {
      feed: 0,
      home: 0,
      sitemap: 0,
      unknown: 0,
    },
    rejectedByReason: {},
    contentTypes: {},
  };
}

function finishSourceMetrics(metrics) {
  const finishedAt = new Date().toISOString();
  metrics.finishedAt = finishedAt;

  const start = Date.parse(metrics.startedAt);
  const end = Date.parse(finishedAt);

  if (!Number.isNaN(start) && !Number.isNaN(end)) {
    metrics.durationMs = Math.max(0, end - start);
  } else {
    metrics.durationMs = 0;
  }

  return metrics;
}

function createCycleMetrics() {
  return {
    startedAt: new Date().toISOString(),
    finishedAt: null,
    durationMs: 0,
    sourceRuns: [],
    totals: {
      fetchedCount: 0,
      acceptedCount: 0,
      rejectedCount: 0,
      duplicateCount: 0,
      newCount: 0,
      revisitedCount: 0,
      updatedCount: 0,
      parseErrorCount: 0,
      summaryRetryCount: 0,
      fetchRestrictedCount: 0,
      requiredScopeCategoryRejectCount: 0,
    },
    byBucket: {
      feed: 0,
      home: 0,
      sitemap: 0,
      unknown: 0,
    },
    rejectedByReason: {},
    contentTypes: {},
  };
}

function finishCycleMetrics(cycleMetrics) {
  const finishedAt = new Date().toISOString();
  cycleMetrics.finishedAt = finishedAt;

  const start = Date.parse(cycleMetrics.startedAt);
  const end = Date.parse(finishedAt);
  cycleMetrics.durationMs =
    !Number.isNaN(start) && !Number.isNaN(end) ? Math.max(0, end - start) : 0;

  const totals = cycleMetrics.sourceRuns.reduce(
    (acc, run) => {
      acc.fetchedCount += run.fetchedCount;
      acc.acceptedCount += run.acceptedCount;
      acc.rejectedCount += run.rejectedCount;
      acc.duplicateCount += run.duplicateCount;
      acc.newCount += run.newCount;
      acc.revisitedCount += run.revisitedCount;
      acc.updatedCount += run.updatedCount;
      acc.parseErrorCount += run.parseErrorCount;
      acc.summaryRetryCount += run.summaryRetryCount;
      acc.fetchRestrictedCount += run.fetchRestrictedCount;
      acc.requiredScopeCategoryRejectCount += run.requiredScopeCategoryRejectCount;
      return acc;
    },
    {
      fetchedCount: 0,
      acceptedCount: 0,
      rejectedCount: 0,
      duplicateCount: 0,
      newCount: 0,
      revisitedCount: 0,
      updatedCount: 0,
      parseErrorCount: 0,
      summaryRetryCount: 0,
      fetchRestrictedCount: 0,
      requiredScopeCategoryRejectCount: 0,
    }
  );

  cycleMetrics.totals = totals;
  cycleMetrics.byBucket = cycleMetrics.sourceRuns.reduce(
    (acc, run) => {
      Object.entries(run.acceptedByBucket || {}).forEach(([bucket, count]) => {
        acc[bucket] = (acc[bucket] || 0) + Number(count || 0);
      });
      return acc;
    },
    {
      feed: 0,
      home: 0,
      sitemap: 0,
      unknown: 0,
    }
  );

  cycleMetrics.contentTypes = cycleMetrics.sourceRuns.reduce((acc, run) => {
    Object.entries(run.contentTypes || {}).forEach(([contentType, count]) => {
      acc[contentType] = (acc[contentType] || 0) + Number(count || 0);
    });
    return acc;
  }, {});

  cycleMetrics.rejectedByReason = cycleMetrics.sourceRuns.reduce((acc, run) => {
    Object.entries(run.rejectedByReason || {}).forEach(([reason, count]) => {
      acc[reason] = (acc[reason] || 0) + Number(count || 0);
    });
    return acc;
  }, {});

  return cycleMetrics;
}

module.exports = {
  createSourceMetrics,
  finishSourceMetrics,
  createCycleMetrics,
  finishCycleMetrics,
};
