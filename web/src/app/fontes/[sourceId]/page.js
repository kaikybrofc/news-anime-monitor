import { notFound as renderNotFound } from "next/navigation";
import { ArticleCard } from "@/components/article-card";
import { Pagination } from "@/components/pagination";
import { clampInt, fetchMonitor, readQueryInt, readQueryString } from "@/lib/api";
import { formatNumber } from "@/lib/formatters";

const VALID_SOURCE_IDS = new Set(["animenew", "animecorner", "animenewsnetwork"]);

export async function generateMetadata(props) {
  const resolvedProps = await props;
  const resolvedParams = await resolvedProps?.params;
  const sourceId = String(resolvedParams?.sourceId || "").trim().toLowerCase();
  const canonicalPath = sourceId ? `/fontes/${encodeURIComponent(sourceId)}` : "/fontes";

  return {
    title: `${sourceId} | Fonte | OmniZap Anime Radar`,
    description:
      "Detalhes de cobertura por fonte, com distribuição de conteúdo, ciclo de vida e histórico de artigos processados.",
    alternates: {
      canonical: canonicalPath,
    },
    robots: !sourceId || !VALID_SOURCE_IDS.has(sourceId)
      ? {
          index: false,
          follow: true,
        }
      : undefined,
  };
}

export const dynamic = "force-dynamic";

export default async function FonteDetailPage(props) {
  const resolvedProps = await props;
  const resolvedParams = await resolvedProps?.params;
  const searchParams = resolvedProps?.searchParams;
  const sourceId = String(resolvedParams?.sourceId || "").toLowerCase();
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
    renderNotFound();
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
          <p>Sitemap: {payload.source?.enabledSitemap ? "sim" : "não"}</p>
        </div>
      </article>

      <div className="grid-cards">
        <article className="info-card">
          <h2>Ciclo de vida</h2>
          <div className="list-stack">
            {Object.keys(lifecycle).length ? (
              Object.entries(lifecycle).map(([key, count]) => (
                <p key={key}>
                  {key}: {formatNumber(count)}
                </p>
              ))
            ) : (
              <p className="muted">Sem dados de ciclo de vida.</p>
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
          <h2>Sem artigos para esta fonte</h2>
          <p>Ajuste os filtros ou aguarde o próximo ciclo do monitor.</p>
        </article>
      )}

      <Pagination
        pathname={`/fontes/${sourceId}`}
        searchParams={searchParams}
        offset={payload.offset || offset}
        limit={payload.limit || limit}
        hasMore={Boolean(payload.hasMore)}
        total={payload.total || 0}
      />
    </section>
  );
}
