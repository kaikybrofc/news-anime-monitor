import Link from "next/link";
import { notFound as renderNotFound } from "next/navigation";
import { ArticleCard } from "@/components/article-card";
import { Pagination } from "@/components/pagination";
import { clampInt, fetchMonitor, readQueryInt } from "@/lib/api";
import { formatDateTime, formatNumber, titleFromSlug } from "@/lib/formatters";
import { getSeoEntityConfigByRoute } from "@/lib/seo-entities";
import { PageKicker } from "@/components/page-kicker";

export async function SeoEntityIndexView({ routeKey, searchParams }) {
  const config = getSeoEntityConfigByRoute(routeKey);
  if (!config) {
    return (
      <section className="stack">
        <h1>Entidade não suportada</h1>
        <article className="info-card warning-card">
          <p>O tipo de página solicitado não está configurado.</p>
        </article>
      </section>
    );
  }

  const top = clampInt(readQueryInt(searchParams, "top", 60), 1, 500, 60);
  let payload = { items: [] };
  let errorMessage = "";

  try {
    payload = await fetchMonitor("/seo/entities", {
      type: config.type,
      top,
    });
  } catch (error) {
    errorMessage = error.message;
  }

  const items = payload?.items || [];

  return (
    <div className="page-shell">
      <section className="page-intro">
        <div className="section-heading">
          <PageKicker>Entidades SEO</PageKicker>
          <h1>{config.plural}</h1>
          <p className="lead">{config.lead}</p>
        </div>
      </section>

      {errorMessage ? (
        <article className="info-card warning-card">
          <h2 className="text-[var(--title)]">Falha ao carregar {config.plural.toLowerCase()}</h2>
          <p>{errorMessage}</p>
        </article>
      ) : null}

      {items.length ? (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {items.map((entity) => (
            <Link key={entity.slug} href={`${config.routeBase}/${entity.slug}`} className="info-card flex flex-col gap-3">
              <h2 className="text-2xl">{entity.name}</h2>
              <p>{formatNumber(entity.count)} notícias relacionadas</p>
              <p>{formatNumber(entity.sourceCount)} fontes</p>
              <p>Última aparição: {formatDateTime(entity.lastSeenAt)}</p>
            </Link>
          ))}
        </div>
      ) : (
        <article className="empty-state">
          <h2 className="mb-2 !text-2xl">Sem resultados no momento</h2>
          <p>As páginas desta entidade serão preenchidas conforme a coleta avançar.</p>
        </article>
      )}
    </div>
  );
}

export async function SeoEntityDetailView({ routeKey, params, searchParams }) {
  const config = getSeoEntityConfigByRoute(routeKey);

  if (!config) {
    return (
      <section className="stack">
        <h1>Entidade não suportada</h1>
        <article className="info-card warning-card">
          <p>O tipo de página solicitado não está configurado.</p>
        </article>
      </section>
    );
  }

  const slug = String(params?.slug || "").trim().toLowerCase();
  const title = titleFromSlug(slug);
  const limit = clampInt(readQueryInt(searchParams, "limit", 20), 1, 50, 20);
  const offset = clampInt(readQueryInt(searchParams, "offset", 0), 0, 100000, 0);

  let payload = {
    entity: {
      name: title,
      slug,
      count: 0,
      sourceCount: 0,
      avgScore: 0,
      lastSeenAt: "",
    },
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
    errorMessage = "Slug da entidade ausente.";
  } else {
    try {
      payload = await fetchMonitor(`/seo/${config.type}/${encodeURIComponent(slug)}`, {
        limit,
        offset,
      });
    } catch (error) {
      if (error.status === 404) {
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
          <PageKicker>Entidade</PageKicker>
          <h1>{payload?.entity?.name || title}</h1>
          <p className="lead">Página programática de {config.singular.toLowerCase()} com cobertura consolidada do monitor.</p>
        </div>
      </section>

      <section className="metric-strip">
        <article className="data-card">
          <span className="data-card-label">Total de notícias</span>
          <p className="kpi-number">{formatNumber(payload.total || 0)}</p>
          <p className="data-card-note">Cobertura consolidada desta entidade.</p>
        </article>
        <article className="data-card">
          <span className="data-card-label">Fontes</span>
          <p className="kpi-number">{formatNumber(payload?.entity?.sourceCount || 0)}</p>
          <p className="data-card-note">Origens que citam esta entidade.</p>
        </article>
        <article className="data-card">
          <span className="data-card-label">Score médio</span>
          <p className="kpi-number">{formatNumber(payload?.entity?.avgScore || 0)}</p>
          <p className="data-card-note">Prioridade editorial média.</p>
        </article>
      </section>

      {errorMessage ? (
        <article className="info-card warning-card">
          <h2 className="text-[var(--title)]">Falha ao carregar {config.singular.toLowerCase()}</h2>
          <p>{errorMessage}</p>
        </article>
      ) : null}

      <section className="panel-grid">
        <article className="list-panel">
          <div className="section-heading mb-3">
            <PageKicker>Distribuição</PageKicker>
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
              <p className="muted">Sem distribuição de fontes para esta entidade.</p>
            )}
          </div>
        </article>

        <article className="list-panel">
          <div className="section-heading mb-3">
            <PageKicker>Composição</PageKicker>
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
              <p className="muted">Sem distribuição de conteúdo para esta entidade.</p>
            )}
          </div>
        </article>
      </section>

      {payload.items?.length ? (
        <section className="flex flex-col gap-6">
          <div className="section-heading">
            <PageKicker>Coleção</PageKicker>
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
          <h2 className="mb-2 !text-2xl">Sem notícias para esta entidade</h2>
          <p>Quando novas relações forem detectadas, os artigos aparecerão aqui.</p>
        </article>
      )}

      <Pagination
        pathname={`${config.routeBase}/${slug}`}
        searchParams={searchParams}
        offset={payload.offset || offset}
        limit={payload.limit || limit}
        hasMore={Boolean(payload.hasMore)}
      />
    </div>
  );
}
