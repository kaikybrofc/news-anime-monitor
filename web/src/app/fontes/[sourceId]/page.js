import Link from "next/link";
import { ArticleCard } from "@/components/article-card";
import { Pagination } from "@/components/pagination";
import { clampInt, fetchMonitor, readQueryInt, readQueryString } from "@/lib/api";
import { formatNumber } from "@/lib/formatters";

export function generateMetadata({ params }) {
  const sourceId = String(params.sourceId || "");
  return {
    title: `${sourceId} | Fonte | OmniZap Anime Radar`,
  };
}

export const dynamic = "force-dynamic";

export default async function FonteDetailPage({ params, searchParams }) {
  const sourceId = String(params.sourceId || "").toLowerCase();
  const limit = clampInt(readQueryInt(searchParams, "limit", 20), 1, 50, 20);
  const offset = clampInt(readQueryInt(searchParams, "offset", 0), 0, 100000, 0);
  const bucket = readQueryString(searchParams, "bucket", "").toLowerCase();
  const contentType = readQueryString(searchParams, "contentType", "").toLowerCase();
  const lastSeenEvent = readQueryString(searchParams, "lastSeenEvent", "").toLowerCase();

  let payload = {
    source: {
      id: sourceId,
      name: sourceId,
      monitorUrl: "",
      feedUrl: "",
      enabledSitemap: false,
    },
    total: 0,
    limit,
    offset,
    hasMore: false,
    stats: {
      lifecycle: {},
      contentTypes: {},
    },
    items: [],
  };
  let errorMessage = "";
  let notFound = false;

  try {
    payload = await fetchMonitor(`/sources/${encodeURIComponent(sourceId)}`, {
      limit,
      offset,
      bucket,
      contentType,
      lastSeenEvent,
    });
  } catch (error) {
    if (error.status === 404) {
      notFound = true;
    } else {
      errorMessage = error.message;
    }
  }

  if (notFound) {
    return (
      <section className="stack">
        <h1>Fonte nao encontrada</h1>
        <article className="info-card">
          <p>A fonte `{sourceId}` nao existe no monitor atual.</p>
          <Link href="/fontes" className="btn btn-secondary">
            Voltar para fontes
          </Link>
        </article>
      </section>
    );
  }

  const lifecycle = payload?.stats?.lifecycle || {};
  const contentTypes = payload?.stats?.contentTypes || {};

  return (
    <section className="stack">
      <h1>{payload.source?.name || sourceId}</h1>
      <p className="lead">Detalhamento da cobertura e do ciclo de vida dos artigos.</p>

      {errorMessage ? (
        <article className="info-card warning-card">
          <h2>Falha ao carregar fonte</h2>
          <p>{errorMessage}</p>
        </article>
      ) : null}

      <article className="info-card split-card">
        <div>
          <h2>Total da fonte</h2>
          <p className="kpi-number">{formatNumber(payload.total || 0)}</p>
        </div>
        <div className="meta-stack">
          <p>ID: {payload.source?.id || sourceId}</p>
          <p>Sitemap: {payload.source?.enabledSitemap ? "sim" : "nao"}</p>
        </div>
      </article>

      <div className="grid-cards">
        <article className="info-card">
          <h2>Lifecycle</h2>
          <div className="list-stack">
            {Object.entries(lifecycle).map(([key, count]) => (
              <p key={key}>
                {key}: {formatNumber(count)}
              </p>
            ))}
          </div>
        </article>
        <article className="info-card">
          <h2>Tipos de conteudo</h2>
          <div className="list-stack">
            {Object.entries(contentTypes).map(([key, count]) => (
              <p key={key}>
                {key}: {formatNumber(count)}
              </p>
            ))}
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
          <h2>Sem artigos para esta fonte</h2>
          <p>Ajuste os filtros ou aguarde o proximo ciclo do monitor.</p>
        </article>
      )}

      <Pagination
        pathname={`/fontes/${sourceId}`}
        searchParams={searchParams}
        offset={payload.offset || offset}
        limit={payload.limit || limit}
        hasMore={Boolean(payload.hasMore)}
      />
    </section>
  );
}
