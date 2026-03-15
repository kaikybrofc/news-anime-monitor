import { SeoEntityDetailView } from "@/components/seo-entity-views";
import { titleFromSlug } from "@/lib/formatters";

export const dynamic = "force-dynamic";

export async function generateMetadata(props) {
  const resolvedProps = await props;
  const resolvedParams = await resolvedProps?.params;
  const slug = String(resolvedParams?.slug || "").trim();
  const title = titleFromSlug(slug) || "Anime";

  return {
    title: `${title} | Anime | OmniZap Anime Radar`,
    description: `Página programática com notícias e cobertura sobre ${title}.`,
  };
}

export default async function AnimeDetailPage({ params, searchParams }) {
  return (
    <SeoEntityDetailView
      routeKey="anime"
      params={params}
      searchParams={searchParams}
    />
  );
}
