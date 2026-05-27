import Link from "next/link";
import { ArticleCard } from "@/components/article-card";
import { Pagination } from "@/components/pagination";
import { UnifiedSearch } from "@/components/unified-search";
import { PageKicker } from "@/components/page-kicker";
import { clampInt, fetchMonitor, readQueryInt, readQueryString } from "@/lib/api";
import { getArticleDetailPath, getArticleTitle } from "@/lib/formatters";
import { toAbsoluteSiteUrl } from "@/lib/site-url";

export const dynamic = "force-dynamic";

function normalizeFilters(searchParams) {
  const q = readQueryString(searchParams, "q");
  return {
    q: q.toLowerCase(),
  };
}

export async function generateMetadata(props) {
  const resolvedProps = await props;
  const searchParams = await resolvedProps?.searchParams;
  const filters = normalizeFilters(searchParams);
  const offset = clampInt(readQueryInt(searchParams, "offset", 0), 0, 100000, 0);
  const limit = clampInt(readQueryInt(searchParams, "limit", 20), 1, 50, 20);
  const canonicalQuery = new URLSearchParams();

  if (filters.q) canonicalQuery.set("q", filters.q);
  if (offset > 0) canonicalQuery.set("offset", String(offset));
  if (limit !== 20) canonicalQuery.set("limit", String(limit));

  const canonicalPath = canonicalQuery.size ? `/busca?${canonicalQuery.toString()}` : "/busca";
  const suffix = filters.q ? ` para "${filters.q}"` : "";

  return {
    title: `Busca${suffix} | Anime Radar`,
    description: "Resultados da pesquisa de notícias de anime.",
    alternates: {
      canonical: canonicalPath,
    },
  };
}

export default async function BuscaPage(props) {
  const resolvedProps = await props;
  const searchParams = await resolvedProps?.searchParams;
  const limit = clampInt(readQueryInt(searchParams, "limit", 20), 1, 50, 20);
  const offset = clampInt(readQueryInt(searchParams, "offset", 0), 0, 100000, 0);
  const filters = normalizeFilters(searchParams);
  const hasQuery = Boolean(filters.q);

  let payload = {
    items: [],
    total: 0,
    hasMore: false,
    limit,
    offset,
  };
  let errorMessage = "";

  if (hasQuery) {
    try {
      payload = await fetchMonitor("/articles", {
        limit,
        offset,
        ...filters,
      });
    } catch (error) {
      errorMessage = error.message;
    }
  }

  const canonicalPath = hasQuery ? `/busca?q=${encodeURIComponent(filters.q)}` : "/busca";
  const collectionSchema = {
    "@context": "https://schema.org",
    "@type": "SearchResultsPage",
    name: hasQuery ? `Busca por ${filters.q}` : "Busca de notícias",
    url: toAbsoluteSiteUrl(canonicalPath),
    isPartOf: {
      "@type": "WebSite",
      name: "OmniZap Anime Radar",
      url: toAbsoluteSiteUrl("/"),
    },
    mainEntity: {
      "@type": "ItemList",
      itemListOrder: "https://schema.org/ItemListOrderDescending",
      numberOfItems: Number(payload?.total || 0),
      itemListElement: (payload.items || []).slice(0, 20).map((article, index) => ({
        "@type": "ListItem",
        position: Number(offset) + index + 1,
        url: toAbsoluteSiteUrl(getArticleDetailPath(article)),
        name: getArticleTitle(article),
      })),
    },
  };

  return (
    <div className="page-shell">
      <script type="application/ld+json" suppressHydrationWarning>
        {JSON.stringify(collectionSchema)}
      </script>

      <section className="relative z-[20] md:z-[220] animate-fade-in-up delay-100">
        <UnifiedSearch
          initialQuery={filters.q}
          className="w-full"
          placeholder="Buscar notícia, franquia ou fonte..."
          resultsPath="/busca"
          disableSuggestionsOnMount
          suggestionsMode="inline"
        />
      </section>

      {!hasQuery ? (
        <article className="empty-state animate-fade-in">
          <h2 className="mb-2 !text-2xl">Digite sua busca</h2>
          <p>Escreva o termo no campo acima e clique em Buscar para ver os resultados.</p>
        </article>
      ) : null}

      {errorMessage ? (
        <article className="info-card warning-card animate-fade-in">
          <h2 className="text-[var(--title)]">Falha ao carregar resultados</h2>
          <p>{errorMessage}</p>
        </article>
      ) : null}

      {hasQuery ? (
        <section className="relative z-10 flex flex-col gap-8">
          {payload.items?.length ? (
            <>
              <div className="section-heading">
                <PageKicker>Resultados da busca</PageKicker>
                <h2>Encontramos {Number(payload.total || 0)} resultado(s)</h2>
                <p className="section-copy">
                  Pesquisa por <strong>{filters.q}</strong>.
                </p>
              </div>

              <div className="article-grid">
                {payload.items.map((article, idx) => (
                  <div key={article.id} className="animate-fade-in-up" style={{ animationDelay: `${0.04 * (idx % 10)}s` }}>
                    <ArticleCard article={article} prioritizeImage={idx === 0} />
                  </div>
                ))}
              </div>
            </>
          ) : (
            <article className="empty-state animate-fade-in">
              <h2 className="mb-2 !text-2xl">Nenhum resultado encontrado</h2>
              <p>Tente outro termo ou volte para a coleção completa.</p>
              <Link href="/noticias" className="btn btn-secondary mt-6 inline-flex">
                Ver todas as notícias
              </Link>
            </article>
          )}
        </section>
      ) : null}

      {hasQuery ? (
        <Pagination
          pathname="/busca"
          searchParams={searchParams}
          offset={payload.offset || offset}
          limit={payload.limit || limit}
          hasMore={Boolean(payload.hasMore)}
        />
      ) : null}
    </div>
  );
}
