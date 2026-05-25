import Link from "next/link";
import { ArticleCard } from "@/components/article-card";
import { Pagination } from "@/components/pagination";
import { UnifiedSearch } from "@/components/unified-search";
import { clampInt, fetchMonitor, readQueryInt, readQueryString } from "@/lib/api";
import { getArticleDetailPath, getArticleTitle } from "@/lib/formatters";
import { toAbsoluteSiteUrl } from "@/lib/site-url";

export async function generateMetadata(props) {
  const resolvedProps = await props;
  const searchParams = await resolvedProps?.searchParams;
  const offset = clampInt(readQueryInt(searchParams, "offset", 0), 0, 100000, 0);
  const limit = clampInt(readQueryInt(searchParams, "limit", 20), 1, 50, 20);
  const q = readQueryString(searchParams, "q");
  const source = readQueryString(searchParams, "source");
  const bucket = readQueryString(searchParams, "bucket");

  const canonicalQuery = new URLSearchParams();
  if (offset > 0) canonicalQuery.set("offset", String(offset));
  if (limit !== 20) canonicalQuery.set("limit", String(limit));
  if (q) canonicalQuery.set("q", q);
  if (source) canonicalQuery.set("source", source);
  if (bucket) canonicalQuery.set("bucket", bucket);

  const canonicalPath = canonicalQuery.size ? `/noticias?${canonicalQuery.toString()}` : "/noticias";

  return {
    title: offset > 0 ? `Notícias (Página ${Math.floor(offset / limit) + 1}) | Anime Radar` : "Notícias | Anime Radar",
    description: "Acompanhe as notícias de anime monitoradas em tempo real.",
    alternates: {
      canonical: canonicalPath,
    },
  };
}

export const dynamic = "force-dynamic";

function normalizeFilters(searchParams) {
  const source = readQueryString(searchParams, "source");
  const bucket = readQueryString(searchParams, "bucket");
  const contentType = readQueryString(searchParams, "contentType");
  const lastSeenEvent = readQueryString(searchParams, "lastSeenEvent");
  const q = readQueryString(searchParams, "q");

  return {
    source: source.toLowerCase(),
    bucket: bucket.toLowerCase(),
    contentType: contentType.toLowerCase(),
    lastSeenEvent: lastSeenEvent.toLowerCase(),
    q: q.toLowerCase(),
  };
}

export default async function NoticiasPage(props) {
  const resolvedProps = await props;
  const searchParams = await resolvedProps?.searchParams;
  const limit = clampInt(readQueryInt(searchParams, "limit", 20), 1, 50, 20);
  const offset = clampInt(readQueryInt(searchParams, "offset", 0), 0, 100000, 0);
  const filters = normalizeFilters(searchParams);

  let payload = {
    items: [],
    total: 0,
    hasMore: false,
    limit,
    offset,
  };
  let errorMessage = "";

  try {
    payload = await fetchMonitor("/articles", {
      limit,
      offset,
      ...filters,
    });
  } catch (error) {
    errorMessage = error.message;
  }

  const canonicalPath = "/noticias";
  const collectionSchema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Notícias de Anime",
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
        />
      </section>

      {errorMessage ? (
        <article className="info-card warning-card animate-fade-in">
          <h2 className="text-[var(--title)]">Falha ao carregar notícias</h2>
          <p>{errorMessage}</p>
        </article>
      ) : null}

      <section className="relative z-10 flex flex-col gap-8">
        {payload.items?.length ? (
          <>
            <div className="section-heading">
              <span className="page-kicker">Coleção atual</span>
              <h2>Leituras recentes do radar</h2>
              <p className="section-copy">
                Página {Math.floor((payload.offset || offset) / (payload.limit || limit)) + 1} da coleção pública com monitoramento contínuo.
              </p>
            </div>
            <div className="article-grid">
              {payload.items.map((article, idx) => (
                <div key={article.id} className="animate-fade-in-up" style={{ animationDelay: `${0.04 * (idx % 10)}s` }}>
                  <ArticleCard article={article} />
                </div>
              ))}
            </div>
          </>
        ) : (
          <article className="empty-state animate-fade-in">
            <h2 className="mb-2 !text-2xl">Sem resultados</h2>
            <p>Não encontramos artigos para os filtros atuais.</p>
            <Link href="/noticias" className="btn btn-secondary mt-6 inline-flex">
              Limpar filtros
            </Link>
          </article>
        )}
      </section>

      <Pagination
        pathname="/noticias"
        searchParams={searchParams}
        offset={payload.offset || offset}
        limit={payload.limit || limit}
        hasMore={Boolean(payload.hasMore)}
      />
    </div>
  );
}
