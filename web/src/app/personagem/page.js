import { SeoEntityIndexView } from "@/components/seo-entity-views";

export const metadata = {
  title: "Personagens | OmniZap Anime Radar",
  description:
    "Índice programático de personagens citados nas notícias com páginas dedicadas e cobertura associada.",
  alternates: {
    canonical: "/personagem",
  },
};

export const dynamic = "force-dynamic";

export default async function PersonagemIndexPage({ searchParams }) {
  return <SeoEntityIndexView routeKey="personagem" searchParams={searchParams} />;
}
