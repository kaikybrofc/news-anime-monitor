import { ArticleCard } from "@/components/article-card";
import { Pagination } from "@/components/pagination";
import { clampInt, fetchMonitor, readQueryInt } from "@/lib/api";
import { formatNumber, titleFromSlug } from "@/lib/formatters";
import { notFound as renderNotFound } from "next/navigation";

export async function generateMetadata(props) {
  const resolvedProps = await props;
  const resolvedParams = await resolvedProps?.params;
  const slug = String(resolvedParams?.slug || "").trim().toLowerCase();
  const fallbackName = titleFromSlug(slug) || "Franquia";
  const canonicalPath = slug ? `/franquias/${encodeURIComponent(slug)}` : "/franquias";
  let entityName = fallbackName;
  let shouldNoIndex = !slug;

  if (slug) {
    try {
      const payload = await fetchMonitor(`/franchises/${encodeURIComponent(slug)}`, {
        limit: 1,
        offset: 0,
      });
      entityName = String(payload?.name || fallbackName).trim() || fallbackName;
      shouldNoIndex = Number(payload?.total || 0) <= 0;
    } catch (error) {
      shouldNoIndex = error?.status === 404;
    }
  }

  return {
    title: `${entityName} | Franquia | OmniZap Anime Radar`,
    description:
      "Página de franquia com notícias relacionadas, distribuição por fonte e leitura de cobertura recente.",
    alternates: {
      canonical: canonicalPath,
    },
    robots: shouldNoIndex
      ? {
          index: false,
          follow: true,
        }
      : undefined,
  };
}

export const dynamic = "force-dynamic";

export default async function FranquiaDetailPage(props) {
  const resolvedProps = await props;
  const resolvedParams = await resolvedProps?.params;
  const searchParams = resolvedProps?.searchParams;

  const slug = String(resolvedParams?.slug || "").toLowerCase().trim();
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
  let notFound = false;

  if (!slug) {
    errorMessage = "Slug de franquia ausente.";
  } else {
    try {
      payload = await fetchMonitor(`/franchises/${encodeURIComponent(slug)}`, {
        limit,
        offset,
      });
    } catch (error) {
      if (error?.status === 404) {
        notFound = true;
      } else {
        errorMessage = error.message;
      }
    }
  }

  if (notFound) {
    renderNotFound();
  }

  const sourceDistribution = payload?.stats?.sourceDistribution || [];
  const contentTypes = payload?.stats?.contentTypeDistribution || {};

  return (
    <section className="stack">
      <h1>{payload.name || title}</h1>
      <p className="lead">
        Acompanhamento da franquia com artigos consolidados e distribuição por fonte.
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
          <h2>Distribuição por fonte</h2>
          <div className="list-stack">
            {sourceDistribution.length ? (
              sourceDistribution.map((row) => (
                <p key={row.sourceId}>
                  {row.sourceName}: {formatNumber(row.count)}
                </p>
              ))
            ) : (
              <p className="muted">Sem dados de distribuição.</p>
            )}
          </div>
        </article>

        <article className="info-card">
          <h2>Tipos de conteúdo</h2>
          <div className="list-stack">
            {Object.keys(contentTypes).length ? (
              Object.entries(contentTypes).map(([key, count]) => (
                <p key={key}>
                  {key}: {formatNumber(count)}
                </p>
              ))
            ) : (
              <p className="muted">Sem dados de tipo de conteúdo.</p>
            )}
          </div>
        </article>
      </div>

      {payload.items?.length ? (
        <div className="article-grid">
          {payload.items.map((article) => (
            <ArticleCard key={article.id} article={article} />
          ))}
        </div>
      ) : (
        <article className="info-card">
          <h2>Sem notícias para esta franquia</h2>
          <p>Quando houver cobertura detectada, os artigos aparecerão aqui.</p>
        </article>
      )}

      <Pagination
        pathname={`/franquias/${slug}`}
        searchParams={searchParams}
        offset={payload.offset || offset}
        limit={payload.limit || limit}
        hasMore={Boolean(payload.hasMore)}
        total={payload.total || 0}
      />
    </section>
  );
}
