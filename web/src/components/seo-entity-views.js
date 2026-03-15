import Link from "next/link";
import { ArticleCard } from "@/components/article-card";
import { Pagination } from "@/components/pagination";
import { clampInt, fetchMonitor, readQueryInt } from "@/lib/api";
import { formatDateTime, formatNumber, titleFromSlug } from "@/lib/formatters";
import { getSeoEntityConfigByRoute } from "@/lib/seo-entities";

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
    <section className="stack">
      <h1>{config.plural}</h1>
      <p className="lead">{config.lead}</p>

      {errorMessage ? (
        <article className="info-card warning-card">
          <h2>Falha ao carregar {config.plural.toLowerCase()}</h2>
          <p>{errorMessage}</p>
        </article>
      ) : null}

      {items.length ? (
        <div className="grid-cards">
          {items.map((entity) => (
            <Link
              key={entity.slug}
              href={`${config.routeBase}/${entity.slug}`}
              className="info-card link-card"
            >
              <h2>{entity.name}</h2>
              <p>{formatNumber(entity.count)} notícias relacionadas</p>
              <p>{formatNumber(entity.sourceCount)} fontes</p>
              <p>Última aparição: {formatDateTime(entity.lastSeenAt)}</p>
            </Link>
          ))}
        </div>
      ) : (
        <article className="info-card">
          <h2>Sem resultados no momento</h2>
          <p>As páginas desta entidade serão preenchidas conforme a coleta avançar.</p>
        </article>
      )}
    </section>
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
    return (
      <section className="stack">
        <h1>{config.singular} não encontrado</h1>
        <article className="info-card warning-card">
          <p>Não encontramos dados para `{slug}` nesta entidade.</p>
          <Link href={config.routeBase} className="btn btn-secondary">
            Voltar para {config.plural.toLowerCase()}
          </Link>
        </article>
      </section>
    );
  }

  const sourceDistribution = payload?.stats?.sourceDistribution || [];
  const contentTypes = payload?.stats?.contentTypeDistribution || {};

  return (
    <section className="stack">
      <h1>{payload?.entity?.name || title}</h1>
      <p className="lead">
        Página programática de {config.singular.toLowerCase()} com cobertura consolidada do monitor.
      </p>

      <article className="info-card split-card">
        <div>
          <h2>Total de notícias</h2>
          <p className="kpi-number">{formatNumber(payload.total || 0)}</p>
        </div>
        <div className="meta-stack">
          <p>Slug: {slug}</p>
          <p>Fontes: {formatNumber(payload?.entity?.sourceCount || 0)}</p>
          <p>Score médio: {formatNumber(payload?.entity?.avgScore || 0)}</p>
        </div>
      </article>

      {errorMessage ? (
        <article className="info-card warning-card">
          <h2>Falha ao carregar {config.singular.toLowerCase()}</h2>
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
              <p className="muted">Sem distribuição de fontes para esta entidade.</p>
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
              <p className="muted">Sem distribuição de conteúdo para esta entidade.</p>
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
          <h2>Sem notícias para esta entidade</h2>
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
    </section>
  );
}
