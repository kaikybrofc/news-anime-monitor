import { ArticleCard } from "@/components/article-card";
import { Pagination } from "@/components/pagination";
import { clampInt, fetchMonitor, readQueryInt } from "@/lib/api";
import { formatNumber, titleFromSlug } from "@/lib/formatters";

export function generateMetadata({ params }) {
  const name = titleFromSlug(params.slug || "");
  return {
    title: `${name} | Franquia | OmniZap Anime Radar`,
  };
}

export const dynamic = "force-dynamic";

export default async function FranquiaDetailPage({ params, searchParams }) {
  const slug = String(params.slug || "").toLowerCase();
  const title = titleFromSlug(slug);
  const limit = clampInt(readQueryInt(searchParams, "limit", 20), 1, 50, 20);
  const offset = clampInt(readQueryInt(searchParams, "offset", 0), 0, 100000, 0);

  let payload = {
    slug,
    name: title,
    total: 0,
    limit,
    offset,
    hasMore: false,
    stats: {
      sourceDistribution: [],
      contentTypeDistribution: {},
    },
    items: [],
  };
  let errorMessage = "";

  try {
    payload = await fetchMonitor(`/franchises/${encodeURIComponent(slug)}`, {
      limit,
      offset,
    });
  } catch (error) {
    errorMessage = error.message;
  }

  const sourceDistribution = payload?.stats?.sourceDistribution || [];
  const contentTypes = payload?.stats?.contentTypeDistribution || {};

  return (
    <section className="stack">
      <h1>{payload.name || title}</h1>
      <p className="lead">
        Acompanhamento da franquia com artigos consolidados e distribuicao por fonte.
      </p>

      <article className="info-card split-card">
        <div>
          <h2>Total da franquia</h2>
          <p className="kpi-number">{formatNumber(payload.total || 0)}</p>
        </div>
        <div className="meta-stack">
          <p>Slug: {slug}</p>
          <p>Offset: {formatNumber(payload.offset || offset)}</p>
        </div>
      </article>

      {errorMessage ? (
        <article className="info-card warning-card">
          <h2>Falha ao carregar franquia</h2>
          <p>{errorMessage}</p>
        </article>
      ) : null}

      <div className="grid-cards">
        <article className="info-card">
          <h2>Distribuicao por fonte</h2>
          <div className="list-stack">
            {sourceDistribution.length ? (
              sourceDistribution.map((row) => (
                <p key={row.sourceId}>
                  {row.sourceName}: {formatNumber(row.count)}
                </p>
              ))
            ) : (
              <p className="muted">Sem dados de distribuicao.</p>
            )}
          </div>
        </article>

        <article className="info-card">
          <h2>Tipos de conteudo</h2>
          <div className="list-stack">
            {Object.keys(contentTypes).length ? (
              Object.entries(contentTypes).map(([key, count]) => (
                <p key={key}>
                  {key}: {formatNumber(count)}
                </p>
              ))
            ) : (
              <p className="muted">Sem dados de tipo de conteudo.</p>
            )}
          </div>
        </article>
      </div>

      {payload.items?.length ? (
        <div className="stack">
          {payload.items.map((article) => (
            <ArticleCard key={article.id} article={article} />
          ))}
        </div>
      ) : (
        <article className="info-card">
          <h2>Sem noticias para esta franquia</h2>
          <p>Quando houver cobertura detectada, os artigos aparecerao aqui.</p>
        </article>
      )}

      <Pagination
        pathname={`/franquias/${slug}`}
        searchParams={searchParams}
        offset={payload.offset || offset}
        limit={payload.limit || limit}
        hasMore={Boolean(payload.hasMore)}
      />
    </section>
  );
}
