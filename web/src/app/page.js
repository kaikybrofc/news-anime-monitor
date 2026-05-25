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

      <section className="relative z-[20] md:z-[220] animate-fade-in-up">
        <UnifiedSearch className="mx-auto w-full max-w-4xl" />
      </section>

      <section className="relative z-10 flex flex-col gap-8">
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

    </div>
  );
}
