import Link from "next/link";

export const metadata = {
  title: "API | OmniZap Anime Radar",
  description:
    "Documentacao oficial da API do monitor de noticias de anime com endpoints, filtros e exemplos reais.",
};

const API_BASE_PROD = "https://omnizap.xyz/monitor-api";
const API_BASE_LOCAL = "http://127.0.0.1:3000";

const endpoints = [
  {
    method: "GET",
    path: "/",
    desc: "Inventario bruto atual em memoria (debug rapido).",
  },
  {
    method: "GET",
    path: "/articles",
    desc: "Lista paginada de artigos com filtros por texto, fonte, bucket, tipo e datas.",
  },
  {
    method: "GET",
    path: "/articles/:id",
    desc: "Retorna um artigo pelo ID interno.",
  },
  {
    method: "GET",
    path: "/articles/slug/:slug",
    desc: "Retorna um artigo pelo slug SEO.",
  },
  {
    method: "GET",
    path: "/trends",
    desc: "Tendencias por janela temporal (franquias, topicos e fontes).",
  },
  {
    method: "GET",
    path: "/sources",
    desc: "Resumo agregado das fontes monitoradas.",
  },
  {
    method: "GET",
    path: "/sources/:sourceId",
    desc: "Detalhe de uma fonte com paginação e distribuicoes.",
  },
  {
    method: "GET",
    path: "/franchises",
    desc: "Ranking de franquias detectadas no monitor.",
  },
  {
    method: "GET",
    path: "/franchises/:slug",
    desc: "Detalhe de franquia com artigos, distribuicao por fonte e tipo.",
  },
  {
    method: "GET",
    path: "/seo/entities",
    desc: "Agregacoes SEO por entidade (anime, personagem, estudio, tag).",
  },
  {
    method: "GET",
    path: "/seo/:type/:slug",
    desc: "Detalhe de uma entidade SEO especifica.",
  },
  {
    method: "GET",
    path: "/debug/sources",
    desc: "Metricas tecnicas do ultimo ciclo por fonte e inventario.",
  },
];

const queryParams = [
  { key: "limit", desc: "Quantidade por pagina (padrao da API e maximo configuravel)." },
  { key: "offset", desc: "Deslocamento para paginação." },
  { key: "q", desc: "Busca textual (titulo, resumo, entidades e campos relacionados)." },
  { key: "source | sourceId", desc: "Filtra por ID da fonte (ex.: animenewsnetwork)." },
  { key: "bucket", desc: "Filtra por bucket: feed, home ou sitemap." },
  { key: "contentType", desc: "Filtra por tipo de conteudo (news, brief, unknown)." },
  { key: "lastSeenEvent", desc: "Filtra por evento de ciclo: new, revisited, updated, fetch_restricted." },
  { key: "from / to", desc: "Faixa temporal em formato de data ISO." },
  { key: "windowHours", desc: "Janela em horas para /trends, /sources e /franchises." },
  { key: "top", desc: "Top N de agregados para rankings e tendencias." },
];

const portalPages = [
  { label: "Noticias", href: "/noticias", desc: "Feed editorial paginado." },
  { label: "Tendencias", href: "/tendencias", desc: "Radar de destaque por janela." },
  { label: "Franquias", href: "/franquias", desc: "Hub por franquia detectada." },
  { label: "Fontes", href: "/fontes", desc: "Cobertura por source monitorada." },
];

export default function ApiPage() {
  return (
    <div className="flex flex-col gap-12 animate-fade-in">
      <section className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <div className="h-8 w-1 rounded-full bg-rose-500" />
          <h1 className="!text-4xl">Documentacao da API</h1>
        </div>
        <p className="lead max-w-3xl text-slate-300">
          Esta pagina reflete os endpoints reais do monitor. O frontend usa os mesmos contratos para
          listar noticias, tendencias, franquias e fontes.
        </p>
      </section>

      <section className="grid grid-cols-1 gap-8 xl:grid-cols-3 items-start animate-fade-in-up delay-100">
        <div className="xl:col-span-2 flex flex-col gap-8">
          <article className="info-card !p-8 border-slate-800 bg-slate-900/40">
            <h2 className="mb-3 text-xl font-bold text-slate-100">Base URL</h2>
            <div className="flex flex-col gap-2 text-sm text-slate-300">
              <p>
                Producao (Nginx): <code>{API_BASE_PROD}</code>
              </p>
              <p>
                Local (API direta): <code>{API_BASE_LOCAL}</code>
              </p>
            </div>
          </article>

          <article className="info-card !p-8 border-slate-800 bg-slate-900/40">
            <h2 className="text-xl font-bold text-slate-100 mb-6">Endpoints disponiveis</h2>
            <div className="flex flex-col gap-4">
              {endpoints.map((endpoint) => (
                <div
                  key={endpoint.path}
                  className="bg-slate-950/50 p-4 rounded-xl border border-slate-800 flex flex-col sm:flex-row sm:items-center gap-4 group hover:border-rose-500/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-black bg-rose-500/10 text-rose-500 px-2 py-1 rounded border border-rose-500/20">
                      {endpoint.method}
                    </span>
                    <code className="text-sm font-bold text-slate-300 group-hover:text-rose-400 transition-colors">
                      {endpoint.path}
                    </code>
                  </div>
                  <p className="text-sm text-slate-500 flex-1">{endpoint.desc}</p>
                </div>
              ))}
            </div>
          </article>

          <article className="info-card !p-8">
            <h2 className="text-xl font-bold text-slate-100 mb-6">Filtros e parametros</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {queryParams.map((param) => (
                <div key={param.key} className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
                  <p className="text-xs uppercase tracking-wide text-rose-400 font-black mb-1">{param.key}</p>
                  <p className="text-sm text-slate-400">{param.desc}</p>
                </div>
              ))}
            </div>
          </article>

          <article className="info-card !p-8">
            <h2 className="text-xl font-bold text-slate-100 mb-6">Exemplos reais (cURL)</h2>
            <div className="bg-slate-950 rounded-2xl p-6 font-mono text-sm overflow-x-auto border border-slate-800 shadow-2xl text-slate-300">
              <pre>{`# 1) Noticias mais recentes
curl -X GET "${API_BASE_PROD}/articles?limit=12&offset=0"

# 2) Busca por termo + filtro de fonte
curl -X GET "${API_BASE_PROD}/articles?q=one%20piece&source=animenewsnetwork&limit=20"

# 3) Tendencias das ultimas 72 horas
curl -X GET "${API_BASE_PROD}/trends?windowHours=72&top=10"

# 4) Detalhe por slug SEO
curl -X GET "${API_BASE_PROD}/articles/slug/japanese-animation-tv-ranking-march-2-8-2026-03-15"`}</pre>
            </div>
          </article>
        </div>

        <aside className="flex flex-col gap-6">
          <article className="info-card flex flex-col gap-6">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 border-b border-slate-800 pb-2">
              Informacoes tecnicas
            </h3>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold text-slate-500 uppercase">Formato</span>
                <span className="text-sm font-semibold text-slate-200">JSON (UTF-8)</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold text-slate-500 uppercase">Autenticacao</span>
                <span className="text-sm font-semibold text-slate-200">Publica (sem token)</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold text-slate-500 uppercase">Status/Debug</span>
                <span className="text-sm font-semibold text-slate-200">/debug/sources</span>
              </div>
            </div>
          </article>

          <article className="info-card bg-sky-500/5 border-sky-500/20">
            <h3 className="text-sm font-bold text-sky-400 mb-2">Paginas do portal</h3>
            <p className="text-xs text-slate-400 leading-normal mb-4">
              Rotas corretas do frontend que consomem esta API:
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
