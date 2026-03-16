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
    <article className="info-card !p-2">
      <div className="flex items-center justify-between px-2 py-2">
        <h2 className="text-sm font-black uppercase tracking-widest text-slate-100">{title}</h2>
      </div>
      <div className="list-stack">
        {items.length ? (
          items.map((item) => (
            <Link key={`${title}-${item.slug}`} className="line-link" href={`/franquias/${item.slug}`}>
              <div className="flex items-center justify-between">
                <strong>{getFranchiseDisplayName(item)}</strong>
                <span className="text-rose-400 font-bold">{formatNumber(item[metricKey] || 0)}</span>
              </div>
              <span>{metricLabel}</span>
            </Link>
          ))
        ) : (
          <p className="p-4 text-sm text-slate-600 italic text-center">Sem dados para ranking.</p>
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
          const fetchedItems = Array.isArray(rankingPayload?.items)
            ? rankingPayload.items
            : [];
          if (fetchedItems.length) {
            rankingSeed = fetchedItems;
          }
        } catch {
          // fallback silencioso para manter a página funcional mesmo sem endpoint de ranking
        }
      }

      payload.ranking = buildRankingFromItems(rankingSeed);
    }
  } catch (error) {
    errorMessage = error.message;
  }

  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col gap-4 animate-fade-in">
        <div className="flex items-center gap-3">
          <div className="h-8 w-1 bg-rose-500 rounded-full" />
          <h1 className="!text-4xl">Franquias e Temas</h1>
        </div>
        <p className="lead max-w-2xl text-slate-400">
          Nosso pipeline identifica automaticamente menções a franquias e temas, 
          permitindo uma análise granular do que está em alta.
        </p>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-fade-in-up delay-50">
        <article className="info-card">
          <span className="text-xs font-bold uppercase tracking-widest text-slate-500">Total de franquias</span>
          <p className="kpi-number !text-4xl">{formatNumber(payload.total || 0)}</p>
          <p className="text-[11px] text-slate-500">Detectadas no monitor</p>
        </article>
        <article className="info-card">
          <span className="text-xs font-bold uppercase tracking-widest text-slate-500">Página atual</span>
          <p className="kpi-number !text-4xl">{formatNumber(Math.floor((payload.offset || offset) / (payload.limit || limit)) + 1)}</p>
          <p className="text-[11px] text-slate-500">Navegação paginada</p>
        </article>
        <article className="info-card">
          <span className="text-xs font-bold uppercase tracking-widest text-slate-500">Itens por página</span>
          <p className="kpi-number !text-4xl">{formatNumber(payload.limit || limit)}</p>
          <p className="text-[11px] text-slate-500">Ajustável por querystring</p>
        </article>
      </section>

      {errorMessage ? (
        <article className="info-card warning-card animate-fade-in">
          <h2 className="text-rose-400">Falha ao carregar franquias</h2>
          <p>{errorMessage}</p>
        </article>
      ) : null}

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in-up delay-75">
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

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 animate-fade-in-up delay-100">
        {payload.items?.length ? (
          payload.items.map((item, idx) => (
            <Link
              key={item.slug}
              href={`/franquias/${item.slug}`}
              className="info-card !p-4 group hover:border-rose-500/30 transition-all hover:-translate-y-1"
              style={{ animationDelay: `${0.03 * idx}s` }}
            >
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 group-hover:text-rose-500 transition-colors">
                    #{(payload.offset || offset) + idx + 1}
                  </span>
                  <div className="trend-badge !text-[9px]">Ativo</div>
                </div>
                <h2 className="text-lg font-bold text-slate-100 group-hover:text-rose-400 transition-colors truncate">
                  {getFranchiseDisplayName(item)}
                </h2>
                <div className="text-[10px] text-slate-500">
                  {formatNumber(item.mentions || 0)} menções · score {formatNumber(item.avgScore || 0)}
                </div>
                <div className="flex items-center gap-2 text-[10px] font-medium text-slate-500">
                   Ver notícias →
                </div>
              </div>
            </Link>
          ))
        ) : (
          <p className="text-slate-500 col-span-full py-12 text-center border border-dashed border-slate-800 rounded-2xl">
            Nenhuma franquia detectada pelo monitor.
          </p>
        )}
      </div>

      <section className="animate-fade-in-up">
        <div className="info-card !p-4 border-slate-800/50 bg-slate-900/20">
          <Pagination
            pathname="/franquias"
            searchParams={searchParams}
            offset={payload.offset || offset}
            limit={payload.limit || limit}
            hasMore={Boolean(payload.hasMore)}
          />
        </div>
      </section>
    </div>
  );
}
