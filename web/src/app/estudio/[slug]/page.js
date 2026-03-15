import { SeoEntityDetailView } from "@/components/seo-entity-views";
import { titleFromSlug } from "@/lib/formatters";

export const dynamic = "force-dynamic";

export async function generateMetadata(props) {
  const resolvedProps = await props;
  const resolvedParams = await resolvedProps?.params;
  const slug = String(resolvedParams?.slug || "").trim();
  const title = titleFromSlug(slug) || "Estúdio";

  return {
    title: `${title} | Estúdio | OmniZap Anime Radar`,
    description: `Página programática com cobertura de notícias do estúdio ${title}.`,
  };
}

export default async function EstudioDetailPage({ params, searchParams }) {
  return (
    <SeoEntityDetailView
      routeKey="estudio"
      params={params}
      searchParams={searchParams}
    />
  );
}
