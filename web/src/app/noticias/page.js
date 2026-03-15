import { ArticleCard } from "@/components/article-card";
import { Pagination } from "@/components/pagination";
import { clampInt, fetchMonitor, readQueryInt, readQueryString } from "@/lib/api";

export const metadata = {
  title: "Notícias | OmniZap Anime Radar",
  description:
    "Lista editorial com notícias de anime processadas pelo monitor, com atualização contínua, filtros e paginação.",
  alternates: {
    canonical: "/noticias",
  },
};

export const dynamic = "force-dynamic";

function normalizeFilters(searchParams) {
  const source = readQueryString(searchParams, "source");
  const bucket = readQueryString(searchParams, "bucket");
  const contentType = readQueryString(searchParams, "contentType");
  const lastSeenEvent = readQueryString(searchParams, "lastSeenEvent");

  return {
    source: source.toLowerCase(),
    bucket: bucket.toLowerCase(),
    contentType: contentType.toLowerCase(),
    lastSeenEvent: lastSeenEvent.toLowerCase(),
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
    <section className="stack">
      <h1>Notícias</h1>

      {errorMessage ? (
        <article className="info-card warning-card">
          <h2>Falha ao carregar notícias</h2>
          <p>{errorMessage}</p>
        </article>
      ) : null}

      {payload.items?.length ? (
        <div className="article-grid">
          {payload.items.map((article) => (
            <ArticleCard key={article.id} article={article} />
          ))}
        </div>
      ) : (
        <article className="info-card">
          <h2>Sem resultados</h2>
          <p>Sem artigos para os filtros atuais.</p>
        </article>
      )}

      <Pagination
        pathname="/noticias"
        searchParams={searchParams}
        offset={payload.offset || offset}
        limit={payload.limit || limit}
        hasMore={Boolean(payload.hasMore)}
      />
    </section>
  );
}
