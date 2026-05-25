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
    <div className="page-shell">
      <section className="page-intro">
        <div className="section-heading">
          <span className="page-kicker">Franquia</span>
          <h1>{payload.name || title}</h1>
          <p className="lead">Acompanhamento da franquia com artigos consolidados, distribuição por fonte e leitura contínua de cobertura.</p>
        </div>
      </section>

      <section className="metric-strip">
        <article className="data-card">
          <span className="data-card-label">Total da franquia</span>
          <p className="kpi-number">{formatNumber(payload.total || 0)}</p>
          <p className="data-card-note">Notícias relacionadas detectadas.</p>
        </article>
        <article className="data-card">
          <span className="data-card-label">Slug</span>
          <p className="kpi-number !text-3xl">{slug}</p>
          <p className="data-card-note">Identificador público da coleção.</p>
        </article>
      </section>

      {errorMessage ? (
        <article className="info-card warning-card">
          <h2 className="text-[var(--title)]">Falha ao carregar franquia</h2>
          <p>{errorMessage}</p>
        </article>
      ) : null}

      <section className="panel-grid">
        <article className="list-panel">
          <div className="section-heading mb-3">
            <span className="page-kicker">Distribuição</span>
            <h2>Por fonte</h2>
          </div>
          <div className="list-stack">
            {sourceDistribution.length ? (
              sourceDistribution.map((row) => (
                <div key={row.sourceId} className="line-item">
                  <strong>{row.sourceName}</strong>
                  <span>{formatNumber(row.count)} artigos</span>
                </div>
              ))
            ) : (
              <p className="muted">Sem dados de distribuição.</p>
            )}
          </div>
        </article>

        <article className="list-panel">
          <div className="section-heading mb-3">
            <span className="page-kicker">Composição</span>
            <h2>Tipos de conteúdo</h2>
          </div>
          <div className="list-stack">
            {Object.keys(contentTypes).length ? (
              Object.entries(contentTypes).map(([key, count]) => (
                <div key={key} className="line-item">
                  <strong>{key}</strong>
                  <span>{formatNumber(count)} registros</span>
                </div>
              ))
            ) : (
              <p className="muted">Sem dados de tipo de conteúdo.</p>
            )}
          </div>
        </article>
      </section>

      {payload.items?.length ? (
        <section className="flex flex-col gap-6">
          <div className="section-heading">
            <span className="page-kicker">Coleção</span>
            <h2>Notícias relacionadas</h2>
          </div>
          <div className="article-grid">
            {payload.items.map((article, index) => (
              <ArticleCard key={article.id} article={article} prioritizeImage={index === 0} />
            ))}
          </div>
        </section>
      ) : (
        <article className="empty-state">
          <h2 className="mb-2 !text-2xl">Sem notícias para esta franquia</h2>
          <p>Quando houver cobertura detectada, os artigos aparecerão aqui.</p>
        </article>
      )}

      <Pagination
        pathname={`/franquias/${slug}`}
        searchParams={searchParams}
        offset={payload.offset || offset}
        limit={payload.limit || limit}
        hasMore={Boolean(payload.hasMore)}
      />
    </div>
  );
}
