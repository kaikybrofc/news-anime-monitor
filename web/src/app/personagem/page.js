import { SeoEntityIndexView } from "@/components/seo-entity-views";

export const metadata = {
  title: "Personagens | OmniZap Anime Radar",
};

export const dynamic = "force-dynamic";

export default async function PersonagemIndexPage({ searchParams }) {
  return <SeoEntityIndexView routeKey="personagem" searchParams={searchParams} />;
}
