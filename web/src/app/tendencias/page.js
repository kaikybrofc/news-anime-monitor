import Link from "next/link";
import { clampInt, fetchMonitor, readQueryInt } from "@/lib/api";
import { formatDateTime, formatNumber } from "@/lib/formatters";

export const metadata = {
  title: "Tendências | OmniZap Anime Radar",
};

export const dynamic = "force-dynamic";

export default async function TendenciasPage({ searchParams }) {
  const top = clampInt(readQueryInt(searchParams, "top", 12), 1, 50, 12);
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
    <div className="flex flex-col gap-10">
      {/* Header Section */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <div className="h-8 w-1 bg-rose-500 rounded-full" />
          <h1 className="!text-4xl">Tendências do Radar</h1>
        </div>
        <p className="lead max-w-2xl">
          Análise de dados em tempo real nas últimas {windowHours} horas.
          Identificamos o que está em alta no ecossistema de anime.
        </p>
      </section>

      {errorMessage ? (
        <article className="info-card warning-card">
          <h2 className="text-rose-400">Falha ao carregar tendências</h2>
          <p>{errorMessage}</p>
        </article>
      ) : null}

      {/* KPI Section */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <article className="info-card flex flex-col gap-2 relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 text-slate-800/20 text-6xl font-black group-hover:text-rose-500/10 transition-colors">
            #
          </div>
          <span className="text-xs font-bold uppercase tracking-widest text-slate-500">Volume de artigos</span>
          <p className="kpi-number !text-5xl text-rose-500">{formatNumber(totals.articles || 0)}</p>
          <span className="text-[10px] text-slate-600 font-medium">Processados na janela atual</span>
        </article>
        
        <article className="info-card flex flex-col gap-2 relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 text-slate-800/20 text-6xl font-black group-hover:text-rose-500/10 transition-colors">
            ★
          </div>
          <span className="text-xs font-bold uppercase tracking-widest text-slate-500">Franquias ativas</span>
          <p className="kpi-number !text-5xl">{formatNumber(totals.franchises || 0)}</p>
          <span className="text-[10px] text-slate-600 font-medium">Menções detectadas via pipeline</span>
        </article>

        <article className="info-card flex flex-col gap-2 relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 text-slate-800/20 text-6xl font-black group-hover:text-rose-500/10 transition-colors">
            ●
          </div>
          <span className="text-xs font-bold uppercase tracking-widest text-slate-500">Tópicos únicos</span>
          <p className="kpi-number !text-5xl">{formatNumber(totals.topics || 0)}</p>
          <span className="text-[10px] text-slate-600 font-medium">Categorias e temas identificados</span>
        </article>
      </div>

      {/* Lists Section */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Top Franquias */}
        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-sm font-black uppercase tracking-widest text-slate-100">Top franquias</h2>
            <span className="trend-badge">Alta</span>
          </div>
          <div className="info-card !p-2">
            <div className="list-stack">
              {topFranchises.length ? (
                topFranchises.map((franchise) => (
                  <Link
                    key={franchise.slug}
                    className="line-link"
                    href={`/franquias/${franchise.slug}`}
                  >
                    <div className="flex items-center justify-between">
                      <strong>{franchise.name}</strong>
                      <span className="text-rose-400 font-bold">+{franchise.mentions}</span>
                    </div>
                    <span>
                      Score médio: {formatNumber(franchise.avgScore)}
                    </span>
                  </Link>
                ))
              ) : (
                <p className="p-4 text-sm text-slate-600 italic text-center">Nenhuma franquia no topo.</p>
              )}
            </div>
          </div>
        </section>

        {/* Top Fontes */}
        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-sm font-black uppercase tracking-widest text-slate-100">Top fontes</h2>
            <span className="trend-badge !text-sky-400 !bg-sky-500/10">Ativas</span>
          </div>
          <div className="info-card !p-2">
            <div className="list-stack">
              {topSources.length ? (
                topSources.map((source) => (
                  <Link
                    key={source.sourceId}
                    className="line-link"
                    href={`/fontes/${source.sourceId}`}
                  >
                    <div className="flex items-center justify-between">
                      <strong>{source.sourceName}</strong>
                      <span className="text-slate-300 font-bold">{source.count}</span>
                    </div>
                    <span>
                      Score médio: {formatNumber(source.avgScore)}
                    </span>
                  </Link>
                ))
              ) : (
                <p className="p-4 text-sm text-slate-600 italic text-center">Nenhuma fonte ativa.</p>
              )}
            </div>
          </div>
        </section>

        {/* Top Tópicos */}
        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-sm font-black uppercase tracking-widest text-slate-100">Tópicos recentes</h2>
            <span className="trend-badge !text-amber-400 !bg-amber-500/10">Notícias</span>
          </div>
          <div className="info-card !p-2">
            <div className="list-stack">
              {topTopics.length ? (
                topTopics.map((topic) => (
                  <div key={topic.topicKey} className="line-item">
                    <div className="flex items-center justify-between">
                      <strong className="capitalize">{topic.topicKey}</strong>
                      <span className="text-slate-500">{topic.mentions}</span>
                    </div>
                    <span>
                      Visto em: {formatDateTime(topic.lastSeenAt)}
                    </span>
                  </div>
                ))
              ) : (
                <p className="p-4 text-sm text-slate-600 italic text-center">Nenhum tópico detectado.</p>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
