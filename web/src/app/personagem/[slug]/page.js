import { SeoEntityDetailView } from "@/components/seo-entity-views";
import { titleFromSlug } from "@/lib/formatters";

export const dynamic = "force-dynamic";

export async function generateMetadata(props) {
  const resolvedProps = await props;
  const resolvedParams = await resolvedProps?.params;
  const slug = String(resolvedParams?.slug || "").trim();
  const title = titleFromSlug(slug) || "Personagem";

  return {
    title: `${title} | Personagem | OmniZap Anime Radar`,
    description: `Página programática com notícias relacionadas a ${title}.`,
  };
}

export default async function PersonagemDetailPage({ params, searchParams }) {
  return (
    <SeoEntityDetailView
      routeKey="personagem"
      params={params}
      searchParams={searchParams}
    />
  );
}
