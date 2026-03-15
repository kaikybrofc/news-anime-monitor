import { SeoEntityIndexView } from "@/components/seo-entity-views";

export const metadata = {
  title: "Animes | OmniZap Anime Radar",
};

export const dynamic = "force-dynamic";

export default async function AnimeIndexPage({ searchParams }) {
  return <SeoEntityIndexView routeKey="anime" searchParams={searchParams} />;
}
