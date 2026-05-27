import { notFound as renderNotFound } from "next/navigation";
import { ArticleCard } from "@/components/article-card";
import { Pagination } from "@/components/pagination";
import { clampInt, fetchMonitor, readQueryInt, readQueryString } from "@/lib/api";
import { formatNumber } from "@/lib/formatters";

function getSourceIconUrl(source = {}) {
  const rawUrl = source.monitorUrl || source.feedUrl || source.url || "";
  if (!rawUrl) return "";

  try {
    const { hostname } = new URL(rawUrl);
    return hostname ? `https://icons.duckduckgo.com/ip3/${hostname}.ico` : "";
  } catch {
    return "";
  }
}

const VALID_SOURCE_IDS = new Set([
  "animenew",
  "animecorner",
  "animenewsnetwork",
  "crunchyrollnews",
  "myanimelist",
  "anitrendz",
  "otakuusa",
  "animeherald",
  "animeuknews",
  "otakunews",
  "siliconera",
  "gematsu",
  "nintendolife",
  "pcgamer",
  "eurogamer",
  "rockpapershotgun",
  "igngames",
  "gamespot",
  "aftermath",
  "kakuchopurei",
  "kongbakpao",
]);

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
  const sourceIconUrl = getSourceIconUrl(payload?.source || {});

  return (
    <div className="page-shell">
      <section className="page-intro">
        <div className="section-heading">
          <span className="page-kicker">Fonte monitorada</span>
          <div className="flex items-center gap-3">
            {sourceIconUrl ? (
              <img
                src={sourceIconUrl}
                alt=""
                width="30"
                height="30"
                loading="lazy"
                className="h-[30px] w-[30px] rounded border border-[var(--border)] bg-[var(--background-elevated)]"
              />
            ) : null}
            <h1>{payload.source?.name || sourceId}</h1>
          </div>
          <p className="lead">Detalhamento da cobertura, do ciclo de vida e dos tipos de conteúdo desta fonte dentro do radar.</p>
        </div>
      </section>

      {errorMessage ? (
        <article className="info-card warning-card">
          <h2 className="text-[var(--title)]">Falha ao carregar fonte</h2>
          <p>{errorMessage}</p>
        </article>
      ) : null}

      <section className="metric-strip">
        <article className="data-card">
          <span className="data-card-label">Total da fonte</span>
          <p className="kpi-number">{formatNumber(payload.total || 0)}</p>
          <p className="data-card-note">Artigos rastreados nesta coleção.</p>
        </article>
        <article className="data-card">
          <span className="data-card-label">Sitemap</span>
          <p className="kpi-number !text-3xl">{payload.source?.enabledSitemap ? "Sim" : "Não"}</p>
          <p className="data-card-note">Estrutura de coleta desta origem.</p>
        </article>
      </section>

      <section className="panel-grid">
        <article className="list-panel">
          <div className="section-heading mb-3">
            <span className="page-kicker">Ciclo de vida</span>
            <h2>Status da cobertura</h2>
          </div>
          <div className="list-stack">
            {Object.keys(lifecycle).length ? (
              Object.entries(lifecycle).map(([key, count]) => (
                <div key={key} className="line-item">
                  <strong>{key}</strong>
                  <span>{formatNumber(count)} registros</span>
                </div>
              ))
            ) : (
              <p className="muted">Sem dados de ciclo de vida.</p>
            )}
          </div>
        </article>
        <article className="list-panel">
          <div className="section-heading mb-3">
            <span className="page-kicker">Tipos</span>
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
            <h2>Artigos desta fonte</h2>
          </div>
          <div className="article-grid">
            {payload.items.map((article, index) => (
              <ArticleCard key={article.id} article={article} prioritizeImage={index === 0} />
            ))}
          </div>
        </section>
      ) : (
        <article className="empty-state">
          <h2 className="mb-2 !text-2xl">Sem artigos para esta fonte</h2>
          <p>Ajuste os filtros ou aguarde o próximo ciclo do monitor.</p>
        </article>
      )}

      <Pagination
        pathname={`/fontes/${sourceId}`}
        searchParams={searchParams}
        offset={payload.offset || offset}
        limit={payload.limit || limit}
        hasMore={Boolean(payload.hasMore)}
      />
    </div>
  );
}
