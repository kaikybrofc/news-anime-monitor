import Link from "next/link";
import { redirect } from "next/navigation";
import { fetchDebugMonitor } from "@/lib/debug-api";
import { isDebugSessionAuthenticated } from "@/lib/debug-auth";
import { formatDateTime, formatNumber } from "@/lib/formatters";

export const metadata = {
  title: "Debug Operacional | OmniZap",
  description: "Painel protegido com métricas e alertas do monitor.",
  robots: {
    index: false,
    follow: false,
  },
};

export const dynamic = "force-dynamic";

function asNumber(value, fallback = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return parsed;
}

function formatMs(value) {
  const ms = Math.max(0, asNumber(value, 0));
  if (ms >= 60 * 1000) {
    const minutes = Math.floor(ms / (60 * 1000));
    const seconds = Math.floor((ms % (60 * 1000)) / 1000);
    return `${minutes}m ${seconds}s`;
  }
  if (ms >= 1000) {
    return `${(ms / 1000).toFixed(1)}s`;
  }
  return `${ms}ms`;
}

function formatDeltaPercent(value) {
  const parsed = asNumber(value, 0);
  if (!parsed) return "0%";
  const sign = parsed > 0 ? "+" : "";
  return `${sign}${parsed.toFixed(1)}%`;
}

function statusTone(status = "") {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "critical") {
    return "bg-rose-950/50 border border-rose-700/50 text-rose-300";
  }
  if (normalized === "warning") {
    return "bg-amber-950/40 border border-amber-700/50 text-amber-300";
  }
  return "bg-emerald-950/40 border border-emerald-700/50 text-emerald-300";
}

function severityTone(severity = "") {
  return String(severity || "").toLowerCase() === "critical"
    ? "text-rose-300 border-rose-700/50 bg-rose-950/40"
    : "text-amber-300 border-amber-700/50 bg-amber-950/30";
}

export default async function DebugDashboardPage() {
  const authenticated = await isDebugSessionAuthenticated();
  if (!authenticated) {
    redirect("/debug/login");
  }

  let sourcesPayload = null;
  let alertsPayload = null;
  let errorMessage = "";

  try {
    [sourcesPayload, alertsPayload] = await Promise.all([
      fetchDebugMonitor("/debug/sources"),
      fetchDebugMonitor("/debug/alerts"),
    ]);
  } catch (error) {
    errorMessage = error.message;
  }

  const observability =
    sourcesPayload?.observability || alertsPayload || {};
  const summary = observability?.summary || {};
  const activeAlerts = Array.isArray(observability?.activeAlerts)
    ? observability.activeAlerts
    : [];
  const sourceRows = Array.isArray(observability?.bySource)
    ? observability.bySource
    : [];

  const sourceRuns = Array.isArray(sourcesPayload?.sourceRuns)
    ? sourcesPayload.sourceRuns
    : [];
  const runBySource = new Map(
    sourceRuns.map((run) => [String(run?.source || ""), run])
  );

  const sourcesMerged = sourceRows.map((row) => ({
    ...row,
    run: runBySource.get(String(row?.source || "")) || null,
  }));

  sourceRuns.forEach((run) => {
    const sourceId = String(run?.source || "");
    if (!sourceId) return;
    if (sourcesMerged.some((row) => String(row?.source || "") === sourceId)) {
      return;
    }

    sourcesMerged.push({
      source: sourceId,
      sourceName: run?.sourceName || sourceId,
      status: "ok",
      current: run,
      baseline: {},
      deltas: {},
      alerts: [],
      run,
    });
  });

  const inMemory = sourcesPayload?.inMemory || {};
  const inventory = sourcesPayload?.inventory || {};
  const lastCycle = sourcesPayload?.lastCycle || {};
  const totals = lastCycle?.totals || {};

  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <div className="h-8 w-1 rounded-full bg-rose-500" />
          <h1 className="!text-4xl">Painel de Debug</h1>
        </div>
        <p className="lead max-w-3xl">
          Monitoramento operacional das fontes, alertas automáticos e saúde do
          ciclo de coleta.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/debug" className="btn btn-secondary">
            Atualizar
          </Link>
          <form action="/debug/logout" method="post">
            <button type="submit" className="btn btn-primary">
              Sair
            </button>
          </form>
        </div>
      </section>

      {errorMessage ? (
        <article className="info-card warning-card">
          <h2 className="text-rose-300">Falha ao carregar dados de debug</h2>
          <p>{errorMessage}</p>
        </article>
      ) : null}

      {!errorMessage ? (
        <>
          <section className="kpi-grid">
            <article className="info-card">
              <p className="text-xs uppercase tracking-widest text-slate-400">
                Status geral
              </p>
              <div className="mt-3 flex items-center gap-3">
                <span
                  className={`rounded-md px-3 py-1 text-xs font-bold uppercase ${statusTone(
                    observability?.overallStatus
                  )}`}
                >
                  {String(observability?.overallStatus || "ok")}
                </span>
                <span className="text-xs text-slate-400">
                  Gerado em {formatDateTime(observability?.generatedAt)}
                </span>
              </div>
            </article>

            <article className="info-card">
              <p className="text-xs uppercase tracking-widest text-slate-400">
                Alertas ativos
              </p>
              <p className="kpi-number mt-2">
                {formatNumber(activeAlerts.length)}
              </p>
              <p className="text-xs text-slate-400">
                {formatNumber(summary?.criticalCount || 0)} críticos e{" "}
                {formatNumber(summary?.warningCount || 0)} avisos
              </p>
            </article>

            <article className="info-card">
              <p className="text-xs uppercase tracking-widest text-slate-400">
                Fontes com alerta
              </p>
              <p className="kpi-number mt-2">
                {formatNumber(summary?.sourcesWithAlerts || 0)}
              </p>
              <p className="text-xs text-slate-400">
                de {formatNumber(summary?.sourcesTracked || sourcesMerged.length)} fontes
              </p>
            </article>

            <article className="info-card">
              <p className="text-xs uppercase tracking-widest text-slate-400">
                Último ciclo
              </p>
              <p className="kpi-number mt-2">
                {formatMs(lastCycle?.durationMs || observability?.cycle?.durationMs || 0)}
              </p>
              <p className="text-xs text-slate-400">
                Início {formatDateTime(lastCycle?.startedAt || observability?.cycle?.startedAt)}
              </p>
            </article>
          </section>

          <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            <article className="info-card xl:col-span-2">
              <h2 className="text-lg">Alertas Ativos</h2>
              {activeAlerts.length ? (
                <div className="mt-4 flex flex-col gap-3">
                  {activeAlerts.slice(0, 20).map((alert, index) => (
                    <div
                      key={`${alert?.source || "source"}-${alert?.code || "code"}-${index}`}
                      className={`rounded-xl border px-4 py-3 ${severityTone(
                        alert?.severity
                      )}`}
                    >
                      <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-wide">
                        <span className="font-bold">
                          {String(alert?.severity || "warning")}
                        </span>
                        <span>{String(alert?.sourceName || alert?.source || "fonte")}</span>
                        <code className="rounded bg-black/20 px-1 py-0.5 text-[10px]">
                          {String(alert?.code || "unknown")}
                        </code>
                      </div>
                      <p className="mt-2 text-sm text-slate-100">
                        {String(alert?.message || "Alerta sem mensagem.")}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-sm text-slate-400">
                  Nenhum alerta ativo neste momento.
                </p>
              )}
            </article>

            <article className="info-card">
              <h2 className="text-lg">Inventário</h2>
              <div className="mt-4 flex flex-col gap-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Artigos em memória</span>
                  <strong>{formatNumber(inMemory?.count || 0)}</strong>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Limite em memória</span>
                  <strong>
                    {inMemory?.max ? formatNumber(inMemory.max) : "sem limite"}
                  </strong>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Total consolidado</span>
                  <strong>{formatNumber(inventory?.totalArticles || 0)}</strong>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Fetch restrito</span>
                  <strong>{formatNumber(inventory?.restrictedFetchCount || 0)}</strong>
                </div>
                <div className="mt-2 border-t border-slate-700 pt-3">
                  <p className="text-xs uppercase tracking-widest text-slate-400">
                    Estado do processo
                  </p>
                  <p className="mt-1 text-sm">
                    {sourcesPayload?.isCheckingNews
                      ? "Coleta em execução"
                      : "Coleta em espera"}
                    {" · "}
                    {sourcesPayload?.isShuttingDown
                      ? "Shutdown em andamento"
                      : "Servidor ativo"}
                  </p>
                </div>
              </div>
            </article>
          </section>

          <section className="info-card overflow-x-auto">
            <h2 className="text-lg">Saúde por Fonte</h2>
            <table className="mt-4 w-full min-w-[860px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-700 text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-2 py-2">Fonte</th>
                  <th className="px-2 py-2">Status</th>
                  <th className="px-2 py-2">Fetch</th>
                  <th className="px-2 py-2">Aceitos</th>
                  <th className="px-2 py-2">Rejeitados</th>
                  <th className="px-2 py-2">Duplicados</th>
                  <th className="px-2 py-2">Erros parse</th>
                  <th className="px-2 py-2">Duração</th>
                  <th className="px-2 py-2">Delta coleta</th>
                  <th className="px-2 py-2">Delta aceitos</th>
                </tr>
              </thead>
              <tbody>
                {sourcesMerged.length ? (
                  sourcesMerged.map((row, index) => {
                    const current = row?.current || row?.run || {};
                    const run = row?.run || {};
                    const status = String(row?.status || "ok");
                    const alertCount = Array.isArray(row?.alerts)
                      ? row.alerts.length
                      : 0;

                    return (
                      <tr
                        key={String(row?.source || row?.sourceName || `source-${index}`)}
                        className="border-b border-slate-800/80"
                      >
                        <td className="px-2 py-3">
                          <p className="font-semibold text-slate-100">
                            {String(row?.sourceName || row?.source || "fonte")}
                          </p>
                          <p className="text-xs text-slate-500">
                            {String(row?.source || "-")}
                          </p>
                        </td>
                        <td className="px-2 py-3">
                          <span
                            className={`rounded px-2 py-1 text-[10px] font-bold uppercase ${statusTone(
                              status
                            )}`}
                          >
                            {status}
                          </span>
                          {alertCount ? (
                            <p className="mt-1 text-[11px] text-slate-400">
                              {alertCount} alerta(s)
                            </p>
                          ) : null}
                        </td>
                        <td className="px-2 py-3">
                          {formatNumber(current?.fetchedCount || 0)}
                        </td>
                        <td className="px-2 py-3">
                          {formatNumber(current?.acceptedCount || 0)}
                        </td>
                        <td className="px-2 py-3">
                          {formatNumber(current?.rejectedCount || 0)}
                        </td>
                        <td className="px-2 py-3">
                          {formatNumber(run?.duplicateCount || 0)}
                        </td>
                        <td className="px-2 py-3">
                          {formatNumber(current?.parseErrorCount || 0)}
                        </td>
                        <td className="px-2 py-3">
                          {formatMs(current?.durationMs || run?.durationMs || 0)}
                        </td>
                        <td className="px-2 py-3">
                          {formatDeltaPercent(row?.deltas?.fetchedDeltaPct || 0)}
                        </td>
                        <td className="px-2 py-3">
                          {formatDeltaPercent(row?.deltas?.acceptedDeltaPct || 0)}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={10} className="px-2 py-6 text-center text-slate-400">
                      Sem dados de fonte disponíveis no momento.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>

          <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <article className="info-card">
              <h2 className="text-lg">Totais do Último Ciclo</h2>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg border border-slate-700 p-3">
                  <p className="text-xs uppercase tracking-wide text-slate-400">Fetch</p>
                  <p className="mt-1 font-bold">{formatNumber(totals?.fetchedCount || 0)}</p>
                </div>
                <div className="rounded-lg border border-slate-700 p-3">
                  <p className="text-xs uppercase tracking-wide text-slate-400">Aceitos</p>
                  <p className="mt-1 font-bold">{formatNumber(totals?.acceptedCount || 0)}</p>
                </div>
                <div className="rounded-lg border border-slate-700 p-3">
                  <p className="text-xs uppercase tracking-wide text-slate-400">Rejeitados</p>
                  <p className="mt-1 font-bold">{formatNumber(totals?.rejectedCount || 0)}</p>
                </div>
                <div className="rounded-lg border border-slate-700 p-3">
                  <p className="text-xs uppercase tracking-wide text-slate-400">Duplicados</p>
                  <p className="mt-1 font-bold">{formatNumber(totals?.duplicateCount || 0)}</p>
                </div>
                <div className="rounded-lg border border-slate-700 p-3">
                  <p className="text-xs uppercase tracking-wide text-slate-400">Novos</p>
                  <p className="mt-1 font-bold">{formatNumber(totals?.newCount || 0)}</p>
                </div>
                <div className="rounded-lg border border-slate-700 p-3">
                  <p className="text-xs uppercase tracking-wide text-slate-400">Atualizados</p>
                  <p className="mt-1 font-bold">{formatNumber(totals?.updatedCount || 0)}</p>
                </div>
              </div>
            </article>

            <article className="info-card">
              <h2 className="text-lg">Distribuição por Bucket</h2>
              <div className="mt-4 flex flex-col gap-3 text-sm">
                {Object.entries(lastCycle?.byBucket || {}).length ? (
                  Object.entries(lastCycle?.byBucket || {}).map(([bucket, count]) => (
                    <div
                      key={bucket}
                      className="flex items-center justify-between rounded-lg border border-slate-700 p-3"
                    >
                      <span className="uppercase text-slate-400">{bucket}</span>
                      <strong>{formatNumber(count)}</strong>
                    </div>
                  ))
                ) : (
                  <p className="text-slate-400">
                    Sem dados de bucket no ciclo atual.
                  </p>
                )}
              </div>
            </article>
          </section>
        </>
      ) : null}
    </div>
  );
}
