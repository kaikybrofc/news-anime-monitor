import { SeoEntityIndexView } from "@/components/seo-entity-views";

export const metadata = {
  title: "Animes | OmniZap Anime Radar",
  description:
    "Índice programático de animes com entidades detectadas e notícias relacionadas no radar.",
  alternates: {
    canonical: "/anime",
  },
};

export const dynamic = "force-dynamic";

export default async function AnimeIndexPage({ searchParams }) {
  return <SeoEntityIndexView routeKey="anime" searchParams={searchParams} />;
}
