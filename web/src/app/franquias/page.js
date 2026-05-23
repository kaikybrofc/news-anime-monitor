import Link from "next/link";
import { Pagination } from "@/components/pagination";
import { clampInt, fetchMonitor, readQueryInt } from "@/lib/api";
import { formatNumber } from "@/lib/formatters";

export const metadata = {
  title: "Franquias e Temas | Anime Radar",
  description: "Explore o monitoramento por franquias e temas específicos do mundo anime.",
};

export const dynamic = "force-dynamic";

function slugToDisplayName(slug = "") {
  return String(slug || "")
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getFranchiseDisplayName(item = {}) {
  const explicitName = String(item?.name || "").trim();
  if (explicitName) return explicitName;
  return slugToDisplayName(item?.slug);
}

function buildRankingFromItems(items = []) {
  const safeItems = Array.isArray(items) ? items.slice() : [];

  return {
    byMentions: safeItems
      .slice()
      .sort((a, b) => {
        if (Number(b.mentions || 0) !== Number(a.mentions || 0)) {
          return Number(b.mentions || 0) - Number(a.mentions || 0);
        }
        return Number(b.avgScore || 0) - Number(a.avgScore || 0);
      })
      .slice(0, 5),
    byAvgScore: safeItems
      .slice()
      .sort((a, b) => {
        if (Number(b.avgScore || 0) !== Number(a.avgScore || 0)) {
          return Number(b.avgScore || 0) - Number(a.avgScore || 0);
        }
        return Number(b.mentions || 0) - Number(a.mentions || 0);
      })
      .slice(0, 5),
    byTrend: safeItems
      .slice()
      .sort((a, b) => {
        if (Number(b.maxTrendScore || 0) !== Number(a.maxTrendScore || 0)) {
          return Number(b.maxTrendScore || 0) - Number(a.maxTrendScore || 0);
        }
        return Number(b.mentions || 0) - Number(a.mentions || 0);
      })
      .slice(0, 5),
  };
}

function RankingColumn({ title, items = [], metricKey, metricLabel }) {
  return (
    <article className="list-panel">
      <div className="mb-2 px-2 py-2">
        <h2 className="text-base">{title}</h2>
      </div>
      <div className="list-stack">
        {items.length ? (
          items.map((item) => (
            <Link key={`${title}-${item.slug}`} className="line-link" href={`/franquias/${item.slug}`}>
              <div className="flex items-center justify-between">
                <strong>{getFranchiseDisplayName(item)}</strong>
                <span className="font-bold text-[var(--title)]">{formatNumber(item[metricKey] || 0)}</span>
              </div>
              <span>{metricLabel}</span>
            </Link>
          ))
        ) : (
          <p className="p-4 text-center text-sm italic text-[var(--muted)]">Sem dados para ranking.</p>
        )}
      </div>
    </article>
  );
}

export default async function FranquiasPage(props) {
  const resolvedProps = await props;
  const searchParams = await resolvedProps?.searchParams;
  const limit = clampInt(readQueryInt(searchParams, "limit", 24), 8, 60, 24);
  const offset = clampInt(readQueryInt(searchParams, "offset", 0), 0, 100000, 0);

  let payload = {
    total: 0,
    limit,
    offset,
    hasMore: false,
    items: [],
    ranking: {
      byMentions: [],
      byAvgScore: [],
      byTrend: [],
    },
  };
  let errorMessage = "";

  try {
    payload = await fetchMonitor("/franchises", {
      limit,
      offset,
    });

    const rankingByApi = payload?.ranking || {};
    const hasRankingData =
      (rankingByApi?.byMentions?.length || 0) > 0 ||
      (rankingByApi?.byAvgScore?.length || 0) > 0 ||
      (rankingByApi?.byTrend?.length || 0) > 0;

    if (!hasRankingData) {
      let rankingSeed = Array.isArray(payload?.items) ? payload.items : [];

      if (rankingSeed.length < 5) {
        try {
          const rankingPayload = await fetchMonitor("/franchises", { top: 120 });
          const fetchedItems = Array.isArray(rankingPayload?.items) ? rankingPayload.items : [];
          if (fetchedItems.length) {
            rankingSeed = fetchedItems;
          }
        } catch {
        }
      }

      payload.ranking = buildRankingFromItems(rankingSeed);
    }
  } catch (error) {
    errorMessage = error.message;
  }

  return (
    <div className="page-shell">
      <section className="page-intro animate-fade-in">
        <div className="section-heading">
          <span className="page-kicker">Mapeamento temático</span>
          <h1>Franquias e temas em leitura contínua</h1>
          <p className="lead">
            O monitor identifica relações entre notícias, franquias e temas para construir hubs que facilitam descoberta, prioridade editorial e navegação por contexto.
          </p>
        </div>
      </section>

      <section className="metric-strip animate-fade-in-up delay-50">
        <article className="data-card">
          <span className="data-card-label">Total de franquias</span>
          <p className="kpi-number">{formatNumber(payload.total || 0)}</p>
          <p className="data-card-note">Detectadas pelo monitor.</p>
        </article>
        <article className="data-card">
          <span className="data-card-label">Página atual</span>
          <p className="kpi-number">{formatNumber(Math.floor((payload.offset || offset) / (payload.limit || limit)) + 1)}</p>
          <p className="data-card-note">Navegação paginada.</p>
        </article>
        <article className="data-card">
          <span className="data-card-label">Itens por página</span>
          <p className="kpi-number">{formatNumber(payload.limit || limit)}</p>
          <p className="data-card-note">Ajustável por querystring.</p>
        </article>
      </section>

      {errorMessage ? (
        <article className="info-card warning-card animate-fade-in">
          <h2 className="text-[var(--title)]">Falha ao carregar franquias</h2>
          <p>{errorMessage}</p>
        </article>
      ) : null}

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-3 animate-fade-in-up delay-75">
        <RankingColumn
          title="Top por menções"
          items={payload?.ranking?.byMentions || []}
          metricKey="mentions"
          metricLabel="Mais citadas na cobertura"
        />
        <RankingColumn
          title="Top por score"
          items={payload?.ranking?.byAvgScore || []}
          metricKey="avgScore"
          metricLabel="Melhor score médio"
        />
        <RankingColumn
          title="Top por tendência"
          items={payload?.ranking?.byTrend || []}
          metricKey="maxTrendScore"
          metricLabel="Maior trend score"
        />
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 animate-fade-in-up delay-100">
        {payload.items?.length ? (
          payload.items.map((item, idx) => (
            <Link
              key={item.slug}
              href={`/franquias/${item.slug}`}
              className="info-card !p-5 group transition-all"
              style={{ animationDelay: `${0.03 * idx}s` }}
            >
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <span className="page-kicker">#{(payload.offset || offset) + idx + 1}</span>
                  <span className="trend-badge">Ativo</span>
                </div>
                <h2 className="text-xl truncate">{getFranchiseDisplayName(item)}</h2>
                <p className="text-sm text-[var(--muted-foreground)]">
                  {formatNumber(item.mentions || 0)} menções · score {formatNumber(item.avgScore || 0)}
                </p>
                <div className="article-footer-actions pt-2">
                  <span className="ml-auto text-[11px] font-semibold text-[var(--title)]">Ver notícias →</span>
                </div>
              </div>
            </Link>
          ))
        ) : (
          <article className="empty-state col-span-full">
            <p>Nenhuma franquia detectada pelo monitor.</p>
          </article>
        )}
      </section>

      <Pagination
        pathname="/franquias"
        searchParams={searchParams}
        offset={payload.offset || offset}
        limit={payload.limit || limit}
        hasMore={Boolean(payload.hasMore)}
      />
    </div>
  );
}
