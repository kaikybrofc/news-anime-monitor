import Link from "next/link";
import { clampInt, fetchMonitor, readQueryInt } from "@/lib/api";
import { formatDateTime, formatNumber } from "@/lib/formatters";

export const metadata = {
  title: "Tendências | OmniZap Anime Radar",
  description:
    "Painel de tendências com franquias em alta, tópicos recentes e fontes mais ativas no monitor de anime.",
  alternates: {
    canonical: "/tendencias",
  },
};

export const dynamic = "force-dynamic";

export default async function TendenciasPage({ searchParams }) {
  const top = clampInt(readQueryInt(searchParams, "top", 12), 1, 50, 12);
  const windowHours = clampInt(readQueryInt(searchParams, "windowHours", 72), 1, 24 * 30, 72);

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
    <div className="page-shell">
      <section className="page-intro animate-fade-in">
        <div className="section-heading">
          <span className="page-kicker">Leitura de sinais</span>
          <h1>Tendências editoriais nas últimas {windowHours} horas</h1>
          <p className="lead">
            Um recorte premium do que ganhou tração no ecossistema anime, com franquias em alta, tópicos recentes e fontes mais ativas do ciclo atual.
          </p>
        </div>
      </section>

      {errorMessage ? (
        <article className="info-card warning-card">
          <h2 className="text-[var(--title)]">Falha ao carregar tendências</h2>
          <p>{errorMessage}</p>
        </article>
      ) : null}

      <section className="metric-strip animate-fade-in-up delay-100">
        <article className="data-card">
          <span className="data-card-label">Volume de artigos</span>
          <p className="kpi-number">{formatNumber(totals.articles || 0)}</p>
          <span className="data-card-note">Processados nesta janela.</span>
        </article>
        <article className="data-card">
          <span className="data-card-label">Franquias ativas</span>
          <p className="kpi-number">{formatNumber(totals.franchises || 0)}</p>
          <span className="data-card-note">Menções detectadas pelo monitor.</span>
        </article>
        <article className="data-card">
          <span className="data-card-label">Tópicos únicos</span>
          <p className="kpi-number">{formatNumber(totals.topics || 0)}</p>
          <span className="data-card-note">Temas recorrentes no ciclo atual.</span>
        </article>
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-3 animate-fade-in-up delay-200">
        <section className="flex flex-col gap-4">
          <div className="section-heading">
            <span className="page-kicker">Franquias</span>
            <h2>As mais citadas agora</h2>
          </div>
          <div className="list-panel">
            <div className="list-stack">
              {topFranchises.length ? (
                topFranchises.map((franchise) => (
                  <Link key={franchise.slug} className="line-link" href={`/franquias/${franchise.slug}`}>
                    <div className="flex items-center justify-between">
                      <strong>{franchise.name}</strong>
                      <span className="font-bold text-[var(--title)]">+{franchise.mentions}</span>
                    </div>
                    <span>Score médio: {formatNumber(franchise.avgScore)}</span>
                  </Link>
                ))
              ) : (
                <p className="p-4 text-center text-sm italic text-[var(--muted)]">Nenhuma franquia no topo.</p>
              )}
            </div>
          </div>
        </section>

        <section className="flex flex-col gap-4">
          <div className="section-heading">
            <span className="page-kicker">Fontes</span>
            <h2>Quem mais puxou o ciclo</h2>
          </div>
          <div className="list-panel">
            <div className="list-stack">
              {topSources.length ? (
                topSources.map((source) => (
                  <Link key={source.sourceId} className="line-link" href={`/fontes/${source.sourceId}`}>
                    <div className="flex items-center justify-between">
                      <strong>{source.sourceName}</strong>
                      <span className="font-bold text-[var(--title)]">{source.count}</span>
                    </div>
                    <span>Score médio: {formatNumber(source.avgScore)}</span>
                  </Link>
                ))
              ) : (
                <p className="p-4 text-center text-sm italic text-[var(--muted)]">Nenhuma fonte ativa.</p>
              )}
            </div>
          </div>
        </section>

        <section className="flex flex-col gap-4">
          <div className="section-heading">
            <span className="page-kicker">Tópicos</span>
            <h2>Assuntos que voltaram à superfície</h2>
          </div>
          <div className="list-panel">
            <div className="list-stack">
              {topTopics.length ? (
                topTopics.map((topic) => (
                  <div key={topic.topicKey} className="line-item">
                    <div className="flex items-center justify-between">
                      <strong className="capitalize">{topic.topicKey}</strong>
                      <span>{topic.mentions}</span>
                    </div>
                    <span>Visto em: {formatDateTime(topic.lastSeenAt)}</span>
                  </div>
                ))
              ) : (
                <p className="p-4 text-center text-sm italic text-[var(--muted)]">Nenhum tópico detectado.</p>
              )}
            </div>
          </div>
        </section>
      </section>
    </div>
  );
}
