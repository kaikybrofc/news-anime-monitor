import { ArticleCard } from "@/components/article-card";
import { Pagination } from "@/components/pagination";
import { clampInt, fetchMonitor, readQueryInt, readQueryString } from "@/lib/api";
import { formatNumber } from "@/lib/formatters";

export const metadata = {
  title: "Feed de Notícias | Anime Radar",
  description: "Acompanhe o feed completo de notícias processadas pelo monitor com inteligência de dados.",
};

export const dynamic = "force-dynamic";

function normalizeFilters(searchParams) {
  const source = readQueryString(searchParams, "source");
  const bucket = readQueryString(searchParams, "bucket");
  const contentType = readQueryString(searchParams, "contentType");
  const lastSeenEvent = readQueryString(searchParams, "lastSeenEvent");
  const q = readQueryString(searchParams, "q");

  return {
    source: source.toLowerCase(),
    bucket: bucket.toLowerCase(),
    contentType: contentType.toLowerCase(),
    lastSeenEvent: lastSeenEvent.toLowerCase(),
    q: q.toLowerCase(),
  };
}

export default async function NoticiasPage({ searchParams }) {
  const limit = clampInt(readQueryInt(searchParams, "limit", 20), 1, 50, 20);
  const offset = clampInt(readQueryInt(searchParams, "offset", 0), 0, 100000, 0);
  const filters = normalizeFilters(searchParams);

  let payload = {
    items: [],
    total: 0,
    hasMore: false,
    limit,
    offset,
  };
  let errorMessage = "";

  try {
    payload = await fetchMonitor("/articles", {
      limit,
      offset,
      ...filters,
    });
  } catch (error) {
    errorMessage = error.message;
  }

  return (
    <div className="flex flex-col gap-10">
      {/* Header Section */}
      <section className="flex flex-col gap-4 animate-fade-in">
        <div className="flex items-center gap-3">
          <div className="h-8 w-1 bg-rose-500 rounded-full" />
          <h1 className="!text-4xl">Feed de Notícias</h1>
        </div>
        <p className="lead max-w-2xl">
          Exploração completa da base de dados. Artigos processados com score de relevância, 
          identificação de tipo de conteúdo e histórico de aparição.
        </p>
      </section>

      {/* KPI & Filter Info */}
      <section className="animate-fade-in-up delay-100">
        <article className="info-card !p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-6 overflow-hidden relative">
          <div className="absolute right-0 top-0 h-full w-32 bg-gradient-to-l from-rose-500/5 to-transparent pointer-events-none" />
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Resultados Encontrados</span>
            <p className="text-4xl font-black text-rose-500">{formatNumber(payload.total)}</p>
          </div>
          
          <div className="flex flex-wrap gap-4 items-center text-xs font-medium text-slate-400">
            <div className="flex items-center gap-2 bg-slate-900/50 px-3 py-1.5 rounded-lg border border-slate-800">
              <span className="text-slate-500">Página:</span>
              <span className="text-slate-200">{Math.floor(offset / limit) + 1}</span>
            </div>
            {filters.q && (
              <div className="flex items-center gap-2 bg-rose-500/10 px-3 py-1.5 rounded-lg border border-rose-500/20">
                <span className="text-rose-400">Busca:</span>
                <span className="text-rose-200">{filters.q}</span>
              </div>
            )}
          </div>
        </article>
      </section>

      {errorMessage ? (
        <article className="info-card warning-card animate-fade-in">
          <h2 className="text-rose-400">Falha ao carregar notícias</h2>
          <p>{errorMessage}</p>
        </article>
      ) : null}

      {/* Grid Section */}
      <section className="flex flex-col gap-8">
        {payload.items?.length ? (
          <div className="article-grid">
            {payload.items.map((article, idx) => (
              <div 
                key={article.id} 
                className="animate-fade-in-up" 
                style={{ animationDelay: `${0.05 * (idx % 10)}s` }}
              >
                <ArticleCard article={article} />
              </div>
            ))}
          </div>
        ) : (
          <article className="info-card p-12 text-center animate-fade-in">
            <h2 className="text-slate-200 mb-2">Sem resultados</h2>
            <p className="text-slate-500">Não encontramos artigos para os filtros atuais.</p>
            <Link href="/noticias" className="btn btn-secondary mt-6 inline-flex">Limpar Filtros</Link>
          </article>
        )}
      </section>

      {/* Pagination */}
      <section className="animate-fade-in-up">
        <div className="info-card !p-4 border-slate-800/50 bg-slate-900/20">
          <Pagination
            pathname="/noticias"
            searchParams={searchParams}
            offset={payload.offset || offset}
            limit={payload.limit || limit}
            hasMore={Boolean(payload.hasMore)}
          />
        </div>
      </section>
    </div>
  );
}
