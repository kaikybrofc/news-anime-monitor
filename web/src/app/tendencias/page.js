import Link from "next/link";
import { clampInt, fetchMonitor, readQueryInt } from "@/lib/api";
import { formatDateTime, formatNumber } from "@/lib/formatters";

export const metadata = {
  title: "Tendencias | OmniZap Anime Radar",
};

export const dynamic = "force-dynamic";

export default async function TendenciasPage({ searchParams }) {
  const top = clampInt(readQueryInt(searchParams, "top", 10), 1, 30, 10);
  const windowHours = clampInt(
    readQueryInt(searchParams, "windowHours", 72),
    1,
    24 * 30,
    72
  );

  let payload = null;
  let errorMessage = "";

  try {
    payload = await fetchMonitor("/trends", { top, windowHours });
  } catch (error) {
    errorMessage = error.message;
  }

  const totals = payload?.totals || {};
  const topFranchises = payload?.topFranchises || [];
  const topTopics = payload?.topTopics || [];
  const topSources = payload?.topSources || [];

  return (
    <section className="stack">
      <h1>Tendencias</h1>
      <p className="lead">
        Radar em janela de {formatNumber(windowHours)} horas com destaque por franquia,
        topico e fonte.
      </p>

      {errorMessage ? (
        <article className="info-card warning-card">
          <h2>Falha ao carregar tendencias</h2>
          <p>{errorMessage}</p>
        </article>
      ) : null}

      <div className="grid-cards kpi-grid">
        <article className="info-card">
          <h2>Artigos na janela</h2>
          <p className="kpi-number">{formatNumber(totals.articles || 0)}</p>
        </article>
        <article className="info-card">
          <h2>Franquias em alta</h2>
          <p className="kpi-number">{formatNumber(totals.franchises || 0)}</p>
        </article>
        <article className="info-card">
          <h2>Topicos monitorados</h2>
          <p className="kpi-number">{formatNumber(totals.topics || 0)}</p>
        </article>
      </div>

      <div className="grid-cards three-cols">
        <article className="info-card">
          <h2>Top franquias</h2>
          <div className="list-stack">
            {topFranchises.length ? (
              topFranchises.map((franchise) => (
                <Link
                  key={franchise.slug}
                  className="line-link"
                  href={`/franquias/${franchise.slug}`}
                >
                  <strong>{franchise.name}</strong>
                  <span>
                    {formatNumber(franchise.mentions)} mencoes · score medio{" "}
                    {formatNumber(franchise.avgScore)}
                  </span>
                </Link>
              ))
            ) : (
              <p className="muted">Sem dados de franquias.</p>
            )}
          </div>
        </article>

        <article className="info-card">
          <h2>Top fontes</h2>
          <div className="list-stack">
            {topSources.length ? (
              topSources.map((source) => (
                <Link
                  key={source.sourceId}
                  className="line-link"
                  href={`/fontes/${source.sourceId}`}
                >
                  <strong>{source.sourceName}</strong>
                  <span>
                    {formatNumber(source.count)} artigos · score medio{" "}
                    {formatNumber(source.avgScore)}
                  </span>
                </Link>
              ))
            ) : (
              <p className="muted">Sem dados de fontes.</p>
            )}
          </div>
        </article>

        <article className="info-card">
          <h2>Topicos</h2>
          <div className="list-stack">
            {topTopics.length ? (
              topTopics.map((topic) => (
                <div key={topic.topicKey} className="line-item">
                  <strong>{topic.topicKey}</strong>
                  <span>
                    {formatNumber(topic.mentions)} mencoes ·{" "}
                    {formatDateTime(topic.lastSeenAt)}
                  </span>
                </div>
              ))
            ) : (
              <p className="muted">Sem dados de topicos.</p>
            )}
          </div>
        </article>
      </div>
    </section>
  );
}
