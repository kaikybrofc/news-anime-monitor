import Link from "next/link";
import { fetchMonitor } from "@/lib/api";

export const metadata = {
  title: "API | OmniZap Anime Radar",
  description:
    "Documentação oficial da API do monitor de notícias de anime com endpoints, exemplos, retorno e status operacional.",
};

export const dynamic = "force-dynamic";

const API_BASE_PROD = "https://animeradar.shop/monitor-api";
const API_BASE_LOCAL = "http://127.0.0.1:3000";

const queryParams = [
  { key: "limit", desc: "Quantidade por página (padrão da API e máximo configurável)." },
  { key: "offset", desc: "Deslocamento para paginação." },
  { key: "q", desc: "Busca textual (título, resumo, entidades e campos relacionados)." },
  { key: "source | sourceId", desc: "Filtra por ID da fonte (ex.: animenewsnetwork)." },
  { key: "bucket", desc: "Filtra por bucket: feed, home ou sitemap." },
  { key: "contentType", desc: "Filtra por tipo de conteúdo (news, brief, unknown)." },
  { key: "lastSeenEvent", desc: "Filtra por evento de ciclo: new, revisited, updated, fetch_restricted." },
  { key: "from / to", desc: "Faixa temporal em formato de data ISO." },
  { key: "windowHours", desc: "Janela em horas para /trends, /sources e /franchises." },
  { key: "top", desc: "Top N de agregados para rankings e tendências." },
];

const portalPages = [
  { label: "Notícias", href: "/noticias", desc: "Feed editorial paginado." },
  { label: "Tendências", href: "/tendencias", desc: "Radar de destaque por janela." },
  { label: "Franquias", href: "/franquias", desc: "Hub por franquia detectada." },
  { label: "Fontes", href: "/fontes", desc: "Cobertura por source monitorada." },
];

const endpointDefinitions = [
  {
    key: "root",
    method: "GET",
    path: "/",
    desc: "Inventário bruto atual em memória (debug rápido).",
    curl: `curl -X GET "${API_BASE_PROD}/"`,
    fetcher: async () => fetchMonitor("/"),
  },
  {
    key: "articles",
    method: "GET",
    path: "/articles",
    desc: "Lista paginada de artigos com filtros por texto, fonte, bucket, tipo e datas.",
    curl: `curl -X GET "${API_BASE_PROD}/articles?limit=5&offset=0"`,
    fetcher: async () => fetchMonitor("/articles", { limit: 5, offset: 0 }),
  },
  {
    key: "articleById",
    method: "GET",
    path: "/articles/:id",
    desc: "Retorna um artigo pelo ID interno.",
    curl: `curl -X GET "${API_BASE_PROD}/articles/:id"`,
    fetcher: async () => {
      const list = await fetchMonitor("/articles", { limit: 1, offset: 0 });
      const id = String(list?.items?.[0]?.id || "").trim();
      if (!id) throw new Error("Sem artigo disponível para testar /articles/:id.");
      return fetchMonitor(`/articles/${encodeURIComponent(id)}`);
    },
  },
  {
    key: "articleBySlug",
    method: "GET",
    path: "/articles/slug/:slug",
    desc: "Retorna um artigo pelo slug SEO.",
    curl: `curl -X GET "${API_BASE_PROD}/articles/slug/:slug"`,
    fetcher: async () => {
      const list = await fetchMonitor("/articles", { limit: 1, offset: 0 });
      const slug = String(list?.items?.[0]?.refined?.newsSlug || "").trim();
      if (!slug) throw new Error("Sem slug disponível para testar /articles/slug/:slug.");
      return fetchMonitor(`/articles/slug/${encodeURIComponent(slug)}`);
    },
  },
  {
    key: "trends",
    method: "GET",
    path: "/trends",
    desc: "Tendências por janela temporal (franquias, tópicos e fontes).",
    curl: `curl -X GET "${API_BASE_PROD}/trends?windowHours=72&top=5"`,
    fetcher: async () => fetchMonitor("/trends", { windowHours: 72, top: 5 }),
  },
  {
    key: "sources",
    method: "GET",
    path: "/sources",
    desc: "Resumo agregado das fontes monitoradas.",
    curl: `curl -X GET "${API_BASE_PROD}/sources?top=10"`,
    fetcher: async () => fetchMonitor("/sources", { top: 10 }),
  },
  {
    key: "sourceById",
    method: "GET",
    path: "/sources/:sourceId",
    desc: "Detalhe de uma fonte com paginação e distribuições.",
    curl: `curl -X GET "${API_BASE_PROD}/sources/:sourceId?limit=5&offset=0"`,
    fetcher: async () => {
      const list = await fetchMonitor("/sources", { top: 1 });
      const sourceId = String(list?.items?.[0]?.id || "").trim();
      if (!sourceId) throw new Error("Sem fonte disponível para testar /sources/:sourceId.");
      return fetchMonitor(`/sources/${encodeURIComponent(sourceId)}`, {
        limit: 5,
        offset: 0,
      });
    },
  },
  {
    key: "franchises",
    method: "GET",
    path: "/franchises",
    desc: "Ranking de franquias detectadas no monitor.",
    curl: `curl -X GET "${API_BASE_PROD}/franchises?top=10"`,
    fetcher: async () => fetchMonitor("/franchises", { top: 10 }),
  },
  {
    key: "franchiseBySlug",
    method: "GET",
    path: "/franchises/:slug",
    desc: "Detalhe de franquia com artigos, distribuição por fonte e tipo.",
    curl: `curl -X GET "${API_BASE_PROD}/franchises/:slug?limit=5&offset=0"`,
    fetcher: async () => {
      const list = await fetchMonitor("/franchises", { top: 1 });
      const slug = String(list?.items?.[0]?.slug || "").trim();
      if (!slug) throw new Error("Sem franquia disponível para testar /franchises/:slug.");
      return fetchMonitor(`/franchises/${encodeURIComponent(slug)}`, {
        limit: 5,
        offset: 0,
      });
    },
  },
  {
    key: "seoEntities",
    method: "GET",
    path: "/seo/entities",
    desc: "Agregações SEO por entidade (anime, personagem, estúdio, tag).",
    curl: `curl -X GET "${API_BASE_PROD}/seo/entities?type=anime&top=10"`,
    fetcher: async () => fetchMonitor("/seo/entities", { type: "anime", top: 10 }),
  },
  {
    key: "seoByTypeSlug",
    method: "GET",
    path: "/seo/:type/:slug",
    desc: "Detalhe de uma entidade SEO específica.",
    curl: `curl -X GET "${API_BASE_PROD}/seo/anime/:slug?limit=5&offset=0"`,
    fetcher: async () => {
      const entities = await fetchMonitor("/seo/entities", { type: "anime", top: 1 });
      const slug = String(entities?.items?.[0]?.slug || "").trim();
      if (!slug) throw new Error("Sem entidade disponível para testar /seo/:type/:slug.");
      return fetchMonitor(`/seo/anime/${encodeURIComponent(slug)}`, {
        limit: 5,
        offset: 0,
      });
    },
  },
  {
    key: "debugSources",
    method: "GET",
    path: "/debug/sources",
    desc: "Métricas técnicas do último ciclo por fonte e inventário.",
    curl: `curl -X GET "${API_BASE_PROD}/debug/sources"`,
    fetcher: async () => fetchMonitor("/debug/sources"),
  },
];

function toPreviewPayload(payload) {
  if (Array.isArray(payload)) {
    return payload.slice(0, 2);
  }

  if (!payload || typeof payload !== "object") {
    return payload;
  }

  const preview = {};
  Object.entries(payload)
    .slice(0, 8)
    .forEach(([key, value]) => {
      if (Array.isArray(value)) {
        preview[key] = value.slice(0, 2);
        return;
      }

      if (value && typeof value === "object") {
        preview[key] = Object.fromEntries(Object.entries(value).slice(0, 6));
        return;
      }

      preview[key] = value;
    });
  return preview;
}

function serializePreview(payload) {
  const text = JSON.stringify(toPreviewPayload(payload), null, 2);
  if (!text) return "{}";
  if (text.length <= 1600) return text;
  return `${text.slice(0, 1597)}...`;
}

async function resolveEndpointStatus() {
  const checks = endpointDefinitions.map(async (endpoint) => {
    try {
      const payload = await endpoint.fetcher();
      return {
        ...endpoint,
        online: true,
        error: "",
        preview: serializePreview(payload),
      };
    } catch (error) {
      return {
        ...endpoint,
        online: false,
        error: String(error?.message || "Falha desconhecida."),
        preview: "{}",
      };
    }
  });

  return Promise.all(checks);
}

export default async function ApiPage() {
  const endpointStatus = await resolveEndpointStatus();
  const onlineCount = endpointStatus.filter((item) => item.online).length;
  const offlineCount = endpointStatus.length - onlineCount;

  return (
    <div className="flex flex-col gap-12 animate-fade-in">
      <section className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <div className="h-8 w-1 rounded-full bg-rose-500" />
          <h1 className="!text-4xl">Documentação da API</h1>
        </div>
        <p className="lead max-w-3xl text-slate-300">
          Esta página mostra endpoints reais do monitor com exemplo de chamada, retorno e status operacional em tempo real.
        </p>
      </section>

      <section className="grid grid-cols-1 gap-8 xl:grid-cols-3 items-start animate-fade-in-up delay-100">
        <div className="xl:col-span-2 flex flex-col gap-8">
          <article className="info-card !p-8 border-slate-800 bg-slate-900/40">
            <h2 className="mb-3 text-xl font-bold text-slate-100">Base URL</h2>
            <div className="flex flex-col gap-2 text-sm text-slate-300">
              <p>
                Produção (Nginx): <code>{API_BASE_PROD}</code>
              </p>
              <p>
                Local (API direta): <code>{API_BASE_LOCAL}</code>
              </p>
            </div>
          </article>

          <article className="info-card !p-8 border-slate-800 bg-slate-900/40">
            <div className="mb-6 flex flex-wrap items-center gap-3">
              <h2 className="text-xl font-bold text-slate-100">Endpoints com Status e Retorno</h2>
              <span className="rounded border border-emerald-600/30 bg-emerald-500/10 px-2 py-1 text-[11px] font-bold text-emerald-300">
                Online: {onlineCount}
              </span>
              <span className="rounded border border-rose-600/30 bg-rose-500/10 px-2 py-1 text-[11px] font-bold text-rose-300">
                Falha: {offlineCount}
              </span>
            </div>
            <div className="flex flex-col gap-6">
              {endpointStatus.map((endpoint) => (
                <article
                  key={endpoint.key}
                  className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5"
                >
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <span className="rounded border border-rose-500/20 bg-rose-500/10 px-2 py-1 text-[10px] font-black text-rose-400">
                      {endpoint.method}
                    </span>
                    <code className="text-sm font-bold text-slate-200">{endpoint.path}</code>
                    <span
                      className={`rounded px-2 py-1 text-[10px] font-black uppercase ${
                        endpoint.online
                          ? "border border-emerald-600/30 bg-emerald-500/10 text-emerald-300"
                          : "border border-rose-600/30 bg-rose-500/10 text-rose-300"
                      }`}
                    >
                      {endpoint.online ? "operando" : "indisponível"}
                    </span>
                  </div>

                  <p className="mb-4 text-sm text-slate-400">{endpoint.desc}</p>

                  <div className="mb-4">
                    <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Exemplo de chamada</p>
                    <pre className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950 p-3 text-xs text-slate-300">
{endpoint.curl}
                    </pre>
                  </div>

                  <div className="mb-3">
                    <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Exemplo de retorno</p>
                    <pre className="max-h-80 overflow-auto rounded-xl border border-slate-800 bg-slate-950 p-3 text-xs text-slate-300">
{endpoint.preview}
                    </pre>
                  </div>

                  {!endpoint.online && endpoint.error ? (
                    <p className="text-xs text-rose-300">
                      Erro: {endpoint.error}
                    </p>
                  ) : null}
                </article>
              ))}
            </div>
          </article>

          <article className="info-card !p-8">
            <h2 className="text-xl font-bold text-slate-100 mb-6">Filtros e parâmetros</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {queryParams.map((param) => (
                <div key={param.key} className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
                  <p className="text-xs uppercase tracking-wide text-rose-400 font-black mb-1">{param.key}</p>
                  <p className="text-sm text-slate-400">{param.desc}</p>
                </div>
              ))}
            </div>
          </article>
        </div>

        <aside className="flex flex-col gap-6">
          <article className="info-card flex flex-col gap-6">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 border-b border-slate-800 pb-2">
              Informações técnicas
            </h3>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold text-slate-500 uppercase">Formato</span>
                <span className="text-sm font-semibold text-slate-200">JSON (UTF-8)</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold text-slate-500 uppercase">Autenticação</span>
                <span className="text-sm font-semibold text-slate-200">Pública (sem token)</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold text-slate-500 uppercase">Atualização</span>
                <span className="text-sm font-semibold text-slate-200">Status em tempo real</span>
              </div>
            </div>
          </article>

          <article className="info-card bg-sky-500/5 border-sky-500/20">
            <h3 className="text-sm font-bold text-sky-400 mb-2">Páginas do portal</h3>
            <p className="text-xs text-slate-400 leading-normal mb-4">
              Rotas do frontend que consomem esta API:
            </p>
            <div className="flex flex-col gap-2">
              {portalPages.map((page) => (
                <Link
                  key={page.href}
                  href={page.href}
                  className="rounded-lg border border-slate-700 px-3 py-2 hover:border-sky-400/40 hover:bg-sky-500/5 transition-colors"
                >
                  <p className="text-sm font-semibold text-slate-100">{page.label}</p>
                  <p className="text-xs text-slate-500">{page.href} - {page.desc}</p>
                </Link>
              ))}
            </div>
          </article>
        </aside>
      </section>
    </div>
  );
}
