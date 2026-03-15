import { SeoEntityIndexView } from "@/components/seo-entity-views";

export const metadata = {
  title: "Estúdios | OmniZap Anime Radar",
  description:
    "Índice programático de estúdios de anime com distribuição de notícias e rastreamento por entidade.",
  alternates: {
    canonical: "/estudio",
  },
};

export const dynamic = "force-dynamic";

export default async function EstudioIndexPage({ searchParams }) {
  return <SeoEntityIndexView routeKey="estudio" searchParams={searchParams} />;
}
