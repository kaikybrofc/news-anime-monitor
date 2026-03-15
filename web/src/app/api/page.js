import { fetchMonitor, getMonitorApiBaseUrl } from "@/lib/api";
import { formatDateTime, formatNumber } from "@/lib/formatters";

export const metadata = {
  title: "API | OmniZap Anime Radar",
};

export const dynamic = "force-dynamic";

export default async function ApiPage() {
  const endpointBase = getMonitorApiBaseUrl();
  const publicPrefix = "/backend";

  let debugPayload = null;
  let errorMessage = "";

  try {
    debugPayload = await fetchMonitor("/debug/sources");
  } catch (error) {
    errorMessage = error.message;
  }

  return (
    <section className="stack">
      <h1>API</h1>
      <p className="lead">
        Area tecnica para status do monitor e referencia dos endpoints publicos.
      </p>

      <article className="info-card">
        <h2>Base atual da API (server-side)</h2>
        <p>{endpointBase}</p>
        <p>Prefixo publico recomendado no dominio: {publicPrefix}</p>
      </article>

      {errorMessage ? (
        <article className="info-card warning-card">
          <h2>Falha ao carregar status da API</h2>
          <p>{errorMessage}</p>
        </article>
      ) : (
        <article className="info-card">
          <h2>Status do monitor</h2>
          <p>Em execucao: {debugPayload?.isCheckingNews ? "sim" : "nao"}</p>
          <p>Artigos em memoria: {formatNumber(debugPayload?.inMemory?.count || 0)}</p>
          <p>Ultimo ciclo: {formatDateTime(debugPayload?.lastCycle?.finishedAt)}</p>
        </article>
      )}

      <div className="grid-cards">
        <article className="info-card">
          <h2>Endpoints principais</h2>
          <div className="list-stack">
            <p>
              <code>{publicPrefix}/articles?limit=20&offset=0</code>
            </p>
            <p>
              <code>{publicPrefix}/trends?top=10&windowHours=72</code>
            </p>
            <p>
              <code>{publicPrefix}/franchises/:slug</code>
            </p>
            <p>
              <code>{publicPrefix}/sources/:sourceId</code>
            </p>
          </div>
        </article>
        <article className="info-card">
          <h2>Debug</h2>
          <p>
            <code>{publicPrefix}/debug/sources</code>
          </p>
          <p>Ideal para acompanhar ciclo, bucket e metricas por fonte.</p>
        </article>
      </div>
    </section>
  );
}
