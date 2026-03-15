import { SeoEntityDetailView } from "@/components/seo-entity-views";
import { titleFromSlug } from "@/lib/formatters";

export const dynamic = "force-dynamic";

export async function generateMetadata(props) {
  const resolvedProps = await props;
  const resolvedParams = await resolvedProps?.params;
  const slug = String(resolvedParams?.slug || "").trim();
  const title = titleFromSlug(slug) || "Tag";

  return {
    title: `${title} | Tag | OmniZap Anime Radar`,
    description: `Página programática com notícias relacionadas à tag ${title}.`,
  };
}

export default async function TagDetailPage({ params, searchParams }) {
  return (
    <SeoEntityDetailView
      routeKey="tag"
      params={params}
      searchParams={searchParams}
    />
  );
}
