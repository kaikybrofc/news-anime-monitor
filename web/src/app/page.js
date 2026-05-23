import Link from "next/link";
import { ArticleCard } from "@/components/article-card";
import { UnifiedSearch } from "@/components/unified-search";
import { fetchMonitor } from "@/lib/api";
import { getArticleDetailPath, getArticleTitle } from "@/lib/formatters";
import { toAbsoluteSiteUrl } from "@/lib/site-url";

export const metadata = {
  title: "Anime Radar | Inteligência em Notícias",
  description:
    "Acompanhe notícias de anime em tempo real com contexto editorial, tendências por franquia e leitura guiada para fãs em 2026.",
  alternates: {
    canonical: "/",
  },
};

export const dynamic = "force-dynamic";

export default async function HomePage() {
  let latestPayload = {
    total: 0,
    items: [],
  };
  let errorMessage = "";

  try {
    latestPayload = await fetchMonitor("/articles", { limit: 8, offset: 0 });
  } catch (error) {
    errorMessage = error.message;
  }

  const websiteSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "OmniZap Anime Radar",
    url: toAbsoluteSiteUrl("/"),
    potentialAction: {
      "@type": "SearchAction",
      target: `${toAbsoluteSiteUrl("/noticias")}?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };

  const collectionSchema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Últimas Notícias de Anime",
    url: toAbsoluteSiteUrl("/"),
    isPartOf: {
      "@type": "WebSite",
      name: "OmniZap Anime Radar",
      url: toAbsoluteSiteUrl("/"),
    },
    mainEntity: {
      "@type": "ItemList",
      itemListElement: (latestPayload.items || []).slice(0, 8).map((article, index) => ({
        "@type": "ListItem",
        position: index + 1,
        url: toAbsoluteSiteUrl(getArticleDetailPath(article)),
        name: getArticleTitle(article),
      })),
    },
  };
  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Anime Radar",
    url: toAbsoluteSiteUrl("/"),
    logo: toAbsoluteSiteUrl("/brand/logo-64.png"),
  };

  return (
    <div className="page-shell">
      <script type="application/ld+json" suppressHydrationWarning>
        {JSON.stringify([websiteSchema, collectionSchema, organizationSchema])}
      </script>

      <section className="editorial-hero animate-fade-in">
        <div className="relative flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex max-w-3xl flex-col gap-5">
            <span className="eyebrow animate-fade-in-up">Sistema editorial em monitoramento contínuo</span>
            <h1 className="animate-fade-in-up delay-100">
              O radar premium para acompanhar o que realmente importa no universo anime.
            </h1>
            <p className="lead animate-fade-in-up delay-200">
              O Anime Radar organiza lançamentos, trailers, rumores e movimentos de franquias em uma leitura mais clara, priorizada e orientada por inteligência editorial.
            </p>
            <div className="flex flex-wrap gap-4 pt-2 animate-fade-in-up delay-300">
              <Link href="/noticias" className="btn btn-primary !px-8 !py-4 text-base">
                Explorar feed editorial
              </Link>
              <Link href="/tendencias" className="btn btn-secondary !px-8 !py-4 text-base">
                Ver tendências do radar
              </Link>
            </div>
          </div>

          <div className="grid w-full max-w-xl grid-cols-1 gap-4 sm:grid-cols-2 animate-fade-in-up delay-300">
            <article className="data-card min-h-[14rem] justify-between !p-6">
              <div className="flex flex-col gap-3">
                <span className="data-card-label">Cobertura viva</span>
                <p className="kpi-number !text-4xl md:!text-5xl">{(latestPayload.total / 1000).toFixed(1)}k+</p>
              </div>
              <p className="data-card-note max-w-[18ch] text-sm leading-relaxed">Artigos monitorados na base editorial.</p>
            </article>
            <article className="data-card min-h-[14rem] justify-between !p-6">
              <div className="flex flex-col gap-3">
                <span className="data-card-label">Ritmo global</span>
                <p className="kpi-number !text-4xl md:!text-5xl">24h</p>
              </div>
              <p className="data-card-note max-w-[20ch] text-sm leading-relaxed">Monitoramento contínuo de fontes e sinais.</p>
            </article>
          </div>
        </div>
      </section>

      <section className="animate-fade-in-up">
        <div className="section-heading mb-5">
          <span className="page-kicker">Descoberta</span>
          <h2>Busque notícias, franquias e fontes em uma única entrada</h2>
          <p className="section-copy">
            A busca unificada conecta conteúdo editorial, hubs de franquia e cobertura por fonte com o mesmo vocabulário visual.
          </p>
        </div>
        <UnifiedSearch className="mx-auto w-full max-w-4xl" />
      </section>

      <section className="flex flex-col gap-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="section-heading">
            <span className="page-kicker">Últimas leituras</span>
            <h2>As histórias mais recentes que entraram no radar</h2>
            <p className="section-copy">Uma seleção do fluxo mais novo já organizada para leitura rápida e contexto imediato.</p>
          </div>
          <Link href="/noticias" className="btn btn-secondary w-fit !px-6 !py-2 text-sm">
            Ver coleção completa
          </Link>
        </div>

        {errorMessage ? (
          <article className="info-card warning-card animate-fade-in">
            <h3 className="text-[var(--title)]">Falha ao carregar destaque editorial</h3>
            <p>{errorMessage}</p>
          </article>
        ) : null}

        {latestPayload.items?.length ? (
          <div className="article-grid">
            {latestPayload.items.map((article, idx) => (
              <div key={article.id} className="animate-fade-in-up" style={{ animationDelay: `${0.08 * (idx + 1)}s` }}>
                <ArticleCard article={article} />
              </div>
            ))}
          </div>
        ) : (
          <article className="empty-state animate-fade-in">
            <p>Nenhuma notícia encontrada no momento.</p>
          </article>
        )}
      </section>

      <section className="panel-grid animate-fade-in-up">
        <article className="info-card flex flex-col gap-4 bg-[color-mix(in_oklab,var(--primary)_6%,transparent)]">
          <span className="page-kicker">Leitura guiada</span>
          <h2 className="!text-3xl">Um portal construído para reduzir ruído e aumentar clareza.</h2>
          <p className="section-copy">
            O foco do produto não é só reunir links: é transformar volume em prioridade, contexto e navegação temática reutilizável.
          </p>
        </article>

        <article className="info-card flex flex-col gap-4">
          <span className="page-kicker">Próximo passo</span>
          <h2 className="!text-3xl">Explore a API e os hubs analíticos do radar.</h2>
          <p className="section-copy">
            Consuma endpoints reais, entre em páginas por franquia e acompanhe os sinais de tendência que estruturam o portal.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Link href="/api" className="btn btn-primary">
              Abrir API
            </Link>
            <Link href="/franquias" className="btn btn-secondary">
              Ver franquias
            </Link>
          </div>
        </article>
      </section>
    </div>
  );
}
