import Link from "next/link";
import { ArticleCard } from "@/components/article-card";
import { Pagination } from "@/components/pagination";
import { clampInt, fetchMonitor, readQueryInt, readQueryString } from "@/lib/api";

export const metadata = {
  title: "Notícias | Anime Radar",
  description: "Acompanhe as notícias de anime monitoradas em tempo real.",
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

export default async function NoticiasPage(props) {
  const resolvedProps = await props;
  const searchParams = await resolvedProps?.searchParams;
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
      {/* Search */}
      <section className="animate-fade-in-up delay-50">
        <div className="info-card glass !p-1 md:!p-2 shadow-2xl overflow-hidden rounded-[2rem]">
          <form action="/noticias" method="get" className="flex flex-col sm:flex-row gap-2">
            <input type="hidden" name="offset" value="0" />
            <input
              type="text"
              name="q"
              defaultValue={filters.q}
              placeholder="Busque por anime, estúdio, trailer, fonte..."
              className="flex-1 bg-transparent border-none px-6 py-4 text-slate-100 text-lg outline-none placeholder:text-slate-500"
            />
            <button type="submit" className="btn btn-primary !rounded-[1.5rem] !px-10 text-lg mx-1 my-1">
              Buscar
            </button>
          </form>
        </div>
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
<section className="animate-fade-in-up mt-6">
  <div className="info-card !p-6 md:!px-10 border-slate-800/40 bg-slate-900/30 shadow-2xl rounded-[2rem]">
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
