import { SeoEntityIndexView } from "@/components/seo-entity-views";

export const metadata = {
  title: "Estúdios | OmniZap Anime Radar",
};

export const dynamic = "force-dynamic";

export default async function EstudioIndexPage({ searchParams }) {
  return <SeoEntityIndexView routeKey="estudio" searchParams={searchParams} />;
}
