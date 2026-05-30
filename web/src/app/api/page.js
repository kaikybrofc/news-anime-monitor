import Link from "next/link";
import { PageKicker } from "@/components/page-kicker";
import { fetchMonitor } from "@/lib/api";

export const metadata = {
  title: "API | OmniZap Anime Radar",
  description:
    "Documentação oficial da API do monitor de notícias de anime com endpoints, exemplos, retorno e status operacional.",
};

export const dynamic = "force-dynamic";

const API_BASE_PROD = "https://animeradar.shop/monitor-api";
const API_BASE_LOCAL = "http://127.0.0.1:3001";

const queryParams = [
  { key: "limit", desc: "Quantidade por página (padrão da API e máximo configurável)." },
  { key: "offset", desc: "Deslocamento para paginação." },
  { key: "q", desc: "Busca textual (título, resumo, entidades e campos relacionados)." },
  { key: "source | sourceId", desc: "Filtra por ID da fonte (ex.: animenewsnetwork)." },
  { key: "bucket", desc: "Filtra por bucket: feed, home ou sitemap." },
  { key: "contentType", desc: "Filtra por tipo de conteúdo (news, brief, unknown)." },
  { key: "lastSeenEvent", desc: "Filtra por evento de ciclo: new, revisited, updated, fetch_restricted." },
  { key: "from / to", desc: "Faixa temporal em formato de data ISO." },
  { key: "windowHours", desc: "Janela em horas para /trends, /calendar, /sources e /franchises." },
  { key: "top", desc: "Top N de agregados para rankings e tendências." },
  { key: "daysBack / daysAhead", desc: "Recorte relativo de dias para o /calendar." },
  { key: "type", desc: "Filtra tipo de evento no /calendar (premiere, episode, movie, game, event, announcement)." },
  { key: "franchise", desc: "Filtra slug de franquia no /calendar." },
  { key: "confidence", desc: "Filtra confiança mínima de data no /calendar (high, medium, low)." },
  { key: "limitPerDay", desc: "Limita quantos eventos por dia retornam no /calendar." },
  { key: "includeEditorial", desc: "Enriquece /trends com artigos representativos, labels amigáveis e cards de apoio." },
];

const portalPages = [
  { label: "Notícias", href: "/noticias", desc: "Feed editorial paginado." },
  { label: "Tendências", href: "/tendencias", desc: "Radar de destaque por janela." },
  { label: "Calendário", href: "/calendario", desc: "Agenda de eventos detectados." },
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
    desc: "Tendências por janela temporal com modo editorial opcional para cards ricos e notícias representativas.",
    curl: `curl -X GET "${API_BASE_PROD}/trends?windowHours=72&top=5&includeEditorial=1"`,
    fetcher: async () => fetchMonitor("/trends", { windowHours: 72, top: 5, includeEditorial: 1 }),
  },
  {
    key: "calendar",
    method: "GET",
    path: "/calendar",
    desc: "Calendario de eventos otaku detectados por parsing de data no titulo e resumo das noticias.",
    curl: `curl -X GET "${API_BASE_PROD}/calendar?daysBack=7&daysAhead=45&limitPerDay=10"`,
    fetcher: async () =>
      fetchMonitor("/calendar", { daysBack: 7, daysAhead: 45, limitPerDay: 10 }),
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
    <div className="page-shell animate-fade-in">
      <section className="page-intro">
        <div className="section-heading">
          <PageKicker>Documentação técnica</PageKicker>
          <h1>API do Anime Radar</h1>
          <p className="lead">
            Endpoints reais do monitor com exemplo de chamada, amostra de retorno e leitura operacional em tempo real dentro de um portal técnico mais claro e premium.
          </p>
        </div>
      </section>

      <section className="grid grid-cols-1 items-start gap-8 xl:grid-cols-3 animate-fade-in-up delay-100">
        <div className="xl:col-span-2 flex flex-col gap-8">
          <article className="info-card !p-8">
            <div className="section-heading">
              <PageKicker>Base URL</PageKicker>
              <h2>Ambientes disponíveis</h2>
            </div>
            <div className="mt-4 flex flex-col gap-3 text-sm text-[var(--muted-foreground)]">
              <p>Produção (Nginx): <code>{API_BASE_PROD}</code></p>
              <p>Local (API direta): <code>{API_BASE_LOCAL}</code></p>
            </div>
          </article>

          <article className="info-card !p-8">
            <div className="mb-6 flex flex-wrap items-center gap-3">
              <h2>Endpoints com status e retorno</h2>
              <span className="status-badge status-new">Online: {onlineCount}</span>
              <span className="status-badge status-restricted">Falha: {offlineCount}</span>
            </div>
            <div className="flex flex-col gap-6">
              {endpointStatus.map((endpoint) => (
                <article key={endpoint.key} className="info-card !p-5">
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <span className="status-badge">{endpoint.method}</span>
                    <code className="text-sm font-bold text-[var(--title)]">{endpoint.path}</code>
                    <span className={`status-badge ${endpoint.online ? "status-new" : "status-restricted"}`}>
                      {endpoint.online ? "operando" : "indisponível"}
                    </span>
                  </div>

                  <p className="mb-4 text-sm text-[var(--muted-foreground)]">{endpoint.desc}</p>

                  <div className="mb-4">
                    <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[var(--muted)]">Exemplo de chamada</p>
                    <pre className="technical-block">
{endpoint.curl}
                    </pre>
                  </div>

                  <div className="mb-3">
                    <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[var(--muted)]">Exemplo de retorno</p>
                    <pre className="max-h-80 overflow-auto rounded-[1rem] border p-3 text-xs" style={{ borderColor: "var(--border-strong)", backgroundColor: "var(--background-elevated)", color: "var(--foreground)" }}>
{endpoint.preview}
                    </pre>
                  </div>

                  {!endpoint.online && endpoint.error ? (
                    <p className="technical-note">Erro: {endpoint.error}</p>
                  ) : null}
                </article>
              ))}
            </div>
          </article>

          <article className="info-card !p-8">
            <div className="section-heading mb-6">
              <PageKicker>Parâmetros</PageKicker>
              <h2>Filtros e querystring</h2>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {queryParams.map((param) => (
                <div key={param.key} className="line-item">
                  <PageKicker as="p">{param.key}</PageKicker>
                  <p className="text-sm text-[var(--muted-foreground)]">{param.desc}</p>
                </div>
              ))}
            </div>
          </article>
        </div>

        <aside className="flex flex-col gap-6">
          <article className="info-card flex flex-col gap-6">
            <div className="section-heading">
              <PageKicker>Informações técnicas</PageKicker>
              <h2>Perfil da API</h2>
            </div>
            <div className="flex flex-col gap-4 text-sm">
              <div className="line-item">
                <strong>Formato</strong>
                <span>JSON (UTF-8)</span>
              </div>
              <div className="line-item">
                <strong>Autenticação</strong>
                <span>Pública (sem token)</span>
              </div>
              <div className="line-item">
                <strong>Atualização</strong>
                <span>Status em tempo real</span>
              </div>
              <div className="line-item">
                <strong>Rate limit</strong>
                <span>Limite global + limite dedicado em rotas de leitura pesada</span>
              </div>
              <div className="line-item">
                <strong>Cache</strong>
                <span>GET com cache curto e header <code>X-Cache</code> (HIT/MISS)</span>
              </div>
            </div>
          </article>

          <article className="info-card flex flex-col gap-4 bg-[color-mix(in_oklab,var(--primary)_5%,transparent)]">
            <div className="section-heading">
              <PageKicker>Portal</PageKicker>
              <h2>Páginas que consomem esta API</h2>
            </div>
            <div className="flex flex-col gap-2">
              {portalPages.map((page) => (
                <Link key={page.href} href={page.href} className="line-link">
                  <strong>{page.label}</strong>
                  <span>{page.href} — {page.desc}</span>
                </Link>
              ))}
            </div>
          </article>
        </aside>
      </section>
    </div>
  );
}
