function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return parsed;
}

function toPositiveInt(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

function toRate(numerator, denominator) {
  const num = toNumber(numerator, 0);
  const den = toNumber(denominator, 0);
  if (den <= 0) return 0;
  return num / den;
}

function average(values = []) {
  if (!Array.isArray(values) || !values.length) return 0;
  const sum = values.reduce((acc, value) => acc + toNumber(value, 0), 0);
  return sum / values.length;
}

function round2(value) {
  return Number(toNumber(value, 0).toFixed(2));
}

function normalizeSourceRun(run = {}, source = {}) {
  const fetchedCount = toNumber(run.fetchedCount, 0);
  const acceptedCount = toNumber(run.acceptedCount, 0);
  const rejectedCount = toNumber(run.rejectedCount, 0);
  const parseErrorCount = toNumber(run.parseErrorCount, 0);
  const durationMs = toNumber(run.durationMs, 0);

  return {
    source: String(run.source || source.id || ""),
    sourceName: String(run.sourceName || source.name || source.id || ""),
    startedAt: String(run.startedAt || ""),
    finishedAt: String(run.finishedAt || ""),
    durationMs,
    fetchedCount,
    acceptedCount,
    rejectedCount,
    parseErrorCount,
    duplicateCount: toNumber(run.duplicateCount, 0),
    acceptedRate: toRate(acceptedCount, fetchedCount),
    rejectedRate: toRate(rejectedCount, fetchedCount),
    parseErrorRate: toRate(parseErrorCount, fetchedCount),
  };
}

function buildBaseline(runs = []) {
  if (!runs.length) {
    return {
      samples: 0,
      fetchedAvg: 0,
      acceptedAvg: 0,
      rejectedAvg: 0,
      parseErrorAvg: 0,
      durationAvg: 0,
      acceptedRateAvg: 0,
      rejectedRateAvg: 0,
      parseErrorRateAvg: 0,
    };
  }

  return {
    samples: runs.length,
    fetchedAvg: round2(average(runs.map((run) => run.fetchedCount))),
    acceptedAvg: round2(average(runs.map((run) => run.acceptedCount))),
    rejectedAvg: round2(average(runs.map((run) => run.rejectedCount))),
    parseErrorAvg: round2(average(runs.map((run) => run.parseErrorCount))),
    durationAvg: round2(average(runs.map((run) => run.durationMs))),
    acceptedRateAvg: round2(average(runs.map((run) => run.acceptedRate))),
    rejectedRateAvg: round2(average(runs.map((run) => run.rejectedRate))),
    parseErrorRateAvg: round2(average(runs.map((run) => run.parseErrorRate))),
  };
}

function buildAlert({
  severity,
  code,
  message,
  source,
  sourceName,
  run,
  baseline,
}) {
  return {
    at: new Date().toISOString(),
    severity: String(severity || "warning"),
    code: String(code || "unknown"),
    message: String(message || ""),
    source: String(source || ""),
    sourceName: String(sourceName || source || ""),
    current: {
      fetchedCount: toNumber(run?.fetchedCount, 0),
      acceptedCount: toNumber(run?.acceptedCount, 0),
      rejectedCount: toNumber(run?.rejectedCount, 0),
      parseErrorCount: toNumber(run?.parseErrorCount, 0),
      durationMs: toNumber(run?.durationMs, 0),
      acceptedRate: round2(toNumber(run?.acceptedRate, 0)),
      rejectedRate: round2(toNumber(run?.rejectedRate, 0)),
      parseErrorRate: round2(toNumber(run?.parseErrorRate, 0)),
    },
    baseline: {
      samples: toNumber(baseline?.samples, 0),
      fetchedAvg: round2(toNumber(baseline?.fetchedAvg, 0)),
      acceptedAvg: round2(toNumber(baseline?.acceptedAvg, 0)),
      rejectedAvg: round2(toNumber(baseline?.rejectedAvg, 0)),
      parseErrorAvg: round2(toNumber(baseline?.parseErrorAvg, 0)),
      durationAvg: round2(toNumber(baseline?.durationAvg, 0)),
      acceptedRateAvg: round2(toNumber(baseline?.acceptedRateAvg, 0)),
      rejectedRateAvg: round2(toNumber(baseline?.rejectedRateAvg, 0)),
      parseErrorRateAvg: round2(toNumber(baseline?.parseErrorRateAvg, 0)),
    },
  };
}

function evaluateSourceAlerts(run, baseline, thresholds = {}) {
  const alerts = [];
  const {
    minBaselineSamples = 3,
    fetchedDropWarningRatio = 0.55,
    fetchedDropCriticalRatio = 0.3,
    acceptedDropWarningRatio = 0.55,
    acceptedDropCriticalRatio = 0.3,
    parseErrorWarningRate = 0.1,
    parseErrorCriticalRate = 0.3,
    rejectSpikeMultiplier = 2,
    rejectSpikeMinDelta = 0.2,
    durationSpikeMultiplier = 2,
    durationSpikeMinMs = 2000,
  } = thresholds;

  if (run.fetchedCount === 0) {
    alerts.push(
      buildAlert({
        severity: "critical",
        code: "source_zero_fetch",
        message: "Fonte sem coleta no ciclo atual (fetchedCount=0).",
        source: run.source,
        sourceName: run.sourceName,
        run,
        baseline,
      })
    );
    return alerts;
  }

  if (run.acceptedCount === 0) {
    alerts.push(
      buildAlert({
        severity: "warning",
        code: "source_zero_accepted",
        message: "Fonte coletou itens, mas não aceitou nenhum artigo neste ciclo.",
        source: run.source,
        sourceName: run.sourceName,
        run,
        baseline,
      })
    );
  }

  if (run.parseErrorRate >= parseErrorCriticalRate || run.parseErrorCount >= 5) {
    alerts.push(
      buildAlert({
        severity: "critical",
        code: "parse_error_spike_critical",
        message: "Taxa de erro de parse em nível crítico.",
        source: run.source,
        sourceName: run.sourceName,
        run,
        baseline,
      })
    );
  } else if (run.parseErrorRate >= parseErrorWarningRate || run.parseErrorCount > 0) {
    alerts.push(
      buildAlert({
        severity: "warning",
        code: "parse_error_spike_warning",
        message: "Erros de parse detectados no ciclo atual.",
        source: run.source,
        sourceName: run.sourceName,
        run,
        baseline,
      })
    );
  }

  if (baseline.samples >= minBaselineSamples) {
    if (baseline.fetchedAvg >= 5) {
      const fetchedRatio = toRate(run.fetchedCount, baseline.fetchedAvg);
      if (fetchedRatio <= fetchedDropCriticalRatio) {
        alerts.push(
          buildAlert({
            severity: "critical",
            code: "collection_drop_critical",
            message: "Queda crítica de coleta em comparação à linha de base.",
            source: run.source,
            sourceName: run.sourceName,
            run,
            baseline,
          })
        );
      } else if (fetchedRatio <= fetchedDropWarningRatio) {
        alerts.push(
          buildAlert({
            severity: "warning",
            code: "collection_drop_warning",
            message: "Queda de coleta acima do limite de alerta.",
            source: run.source,
            sourceName: run.sourceName,
            run,
            baseline,
          })
        );
      }
    }

    if (baseline.acceptedAvg >= 3) {
      const acceptedRatio = toRate(run.acceptedCount, baseline.acceptedAvg);
      if (acceptedRatio <= acceptedDropCriticalRatio) {
        alerts.push(
          buildAlert({
            severity: "critical",
            code: "accepted_drop_critical",
            message: "Queda crítica de itens aceitos em comparação à linha de base.",
            source: run.source,
            sourceName: run.sourceName,
            run,
            baseline,
          })
        );
      } else if (acceptedRatio <= acceptedDropWarningRatio) {
        alerts.push(
          buildAlert({
            severity: "warning",
            code: "accepted_drop_warning",
            message: "Queda de itens aceitos acima do limite de alerta.",
            source: run.source,
            sourceName: run.sourceName,
            run,
            baseline,
          })
        );
      }
    }

    const rejectRateThreshold = baseline.rejectedRateAvg * rejectSpikeMultiplier;
    if (
      baseline.rejectedRateAvg > 0 &&
      run.rejectedRate >= rejectRateThreshold &&
      run.rejectedRate - baseline.rejectedRateAvg >= rejectSpikeMinDelta
    ) {
      alerts.push(
        buildAlert({
          severity: "warning",
          code: "rejected_rate_spike",
          message: "Taxa de rejeição acima do comportamento histórico.",
          source: run.source,
          sourceName: run.sourceName,
          run,
          baseline,
        })
      );
    }

    const durationThreshold = baseline.durationAvg * durationSpikeMultiplier;
    if (
      baseline.durationAvg > 0 &&
      run.durationMs >= durationThreshold &&
      run.durationMs - baseline.durationAvg >= durationSpikeMinMs
    ) {
      alerts.push(
        buildAlert({
          severity: "warning",
          code: "source_slow_cycle",
          message: "Tempo de execução da fonte acima da linha de base.",
          source: run.source,
          sourceName: run.sourceName,
          run,
          baseline,
        })
      );
    }
  }

  return alerts;
}

function deriveSourceStatus(alerts = []) {
  if (!alerts.length) return "ok";
  if (alerts.some((alert) => alert.severity === "critical")) return "critical";
  return "warning";
}

function createObservabilityTracker(sources = [], options = {}) {
  const sourceList = Array.isArray(sources) ? sources : [];
  const historySize = toPositiveInt(options.historySize, 72);
  const baselineWindow = toPositiveInt(options.baselineWindow, 12);
  const thresholds = {
    fetchedDropWarningRatio: toNumber(options.fetchedDropWarningRatio, 0.55),
    fetchedDropCriticalRatio: toNumber(options.fetchedDropCriticalRatio, 0.3),
    acceptedDropWarningRatio: toNumber(options.acceptedDropWarningRatio, 0.55),
    acceptedDropCriticalRatio: toNumber(options.acceptedDropCriticalRatio, 0.3),
    parseErrorWarningRate: toNumber(options.parseErrorWarningRate, 0.1),
    parseErrorCriticalRate: toNumber(options.parseErrorCriticalRate, 0.3),
    rejectSpikeMultiplier: toNumber(options.rejectSpikeMultiplier, 2),
    rejectSpikeMinDelta: toNumber(options.rejectSpikeMinDelta, 0.2),
    durationSpikeMultiplier: toNumber(options.durationSpikeMultiplier, 2),
    durationSpikeMinMs: toNumber(options.durationSpikeMinMs, 2000),
  };

  const historyBySource = new Map(
    sourceList.map((source) => [source.id, []])
  );

  const state = {
    generatedAt: "",
    lastCycleStartedAt: "",
    lastCycleFinishedAt: "",
    lastCycleDurationMs: 0,
    summary: {
      sourcesTracked: sourceList.length,
      sourcesWithAlerts: 0,
      warningCount: 0,
      criticalCount: 0,
    },
    bySource: sourceList.map((source) => ({
      source: source.id,
      sourceName: source.name,
      status: "ok",
      current: {
        fetchedCount: 0,
        acceptedCount: 0,
        rejectedCount: 0,
        parseErrorCount: 0,
        durationMs: 0,
        acceptedRate: 0,
        rejectedRate: 0,
        parseErrorRate: 0,
      },
      baseline: buildBaseline([]),
      deltas: {
        fetchedDeltaPct: 0,
        acceptedDeltaPct: 0,
        parseErrorDelta: 0,
      },
      alerts: [],
      historyDepth: 0,
    })),
    activeAlerts: [],
  };

  function ingestCycleMetrics(cycleMetrics = {}) {
    const sourceRuns = Array.isArray(cycleMetrics.sourceRuns)
      ? cycleMetrics.sourceRuns
      : [];
    const sourceRunIndex = new Map(
      sourceRuns.map((run) => [String(run.source || ""), run])
    );
    const bySource = [];
    const activeAlerts = [];

    sourceList.forEach((source) => {
      const currentRun = normalizeSourceRun(
        sourceRunIndex.get(source.id) || { source: source.id, sourceName: source.name },
        source
      );
      const sourceHistory = historyBySource.get(source.id) || [];
      const baselineSample = sourceHistory.slice(
        Math.max(0, sourceHistory.length - baselineWindow)
      );
      const baseline = buildBaseline(baselineSample);
      const alerts = evaluateSourceAlerts(currentRun, baseline, thresholds);
      const status = deriveSourceStatus(alerts);

      const fetchedDeltaPct = baseline.fetchedAvg
        ? round2(((currentRun.fetchedCount - baseline.fetchedAvg) / baseline.fetchedAvg) * 100)
        : 0;
      const acceptedDeltaPct = baseline.acceptedAvg
        ? round2(((currentRun.acceptedCount - baseline.acceptedAvg) / baseline.acceptedAvg) * 100)
        : 0;
      const parseErrorDelta = round2(currentRun.parseErrorCount - baseline.parseErrorAvg);

      bySource.push({
        source: source.id,
        sourceName: source.name,
        status,
        current: currentRun,
        baseline,
        deltas: {
          fetchedDeltaPct,
          acceptedDeltaPct,
          parseErrorDelta,
        },
        alerts,
        historyDepth: sourceHistory.length,
      });

      alerts.forEach((alert) => activeAlerts.push(alert));

      sourceHistory.push(currentRun);
      if (sourceHistory.length > historySize) {
        sourceHistory.splice(0, sourceHistory.length - historySize);
      }
      historyBySource.set(source.id, sourceHistory);
    });

    const warningCount = activeAlerts.filter(
      (alert) => alert.severity === "warning"
    ).length;
    const criticalCount = activeAlerts.filter(
      (alert) => alert.severity === "critical"
    ).length;

    state.generatedAt = new Date().toISOString();
    state.lastCycleStartedAt = String(cycleMetrics.startedAt || "");
    state.lastCycleFinishedAt = String(cycleMetrics.finishedAt || "");
    state.lastCycleDurationMs = toNumber(cycleMetrics.durationMs, 0);
    state.bySource = bySource;
    state.activeAlerts = activeAlerts;
    state.summary = {
      sourcesTracked: sourceList.length,
      sourcesWithAlerts: bySource.filter((row) => row.alerts.length).length,
      warningCount,
      criticalCount,
    };
  }

  function getSnapshot() {
    const overallStatus =
      state.summary.criticalCount > 0
        ? "critical"
        : state.summary.warningCount > 0
        ? "warning"
        : "ok";

    return {
      generatedAt: state.generatedAt || new Date().toISOString(),
      historySize,
      baselineWindow,
      overallStatus,
      summary: {
        ...state.summary,
      },
      cycle: {
        startedAt: state.lastCycleStartedAt,
        finishedAt: state.lastCycleFinishedAt,
        durationMs: state.lastCycleDurationMs,
      },
      bySource: state.bySource.map((row) => ({
        ...row,
        alerts: Array.isArray(row.alerts) ? row.alerts.slice(0, 10) : [],
      })),
      activeAlerts: state.activeAlerts.slice(0, 120),
    };
  }

  return {
    ingestCycleMetrics,
    getSnapshot,
  };
}

module.exports = {
  createObservabilityTracker,
};
