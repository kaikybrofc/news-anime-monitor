import { SeoEntityIndexView } from "@/components/seo-entity-views";

export const metadata = {
  title: "Tags | OmniZap Anime Radar",
};

export const dynamic = "force-dynamic";

export default async function TagIndexPage({ searchParams }) {
  return <SeoEntityIndexView routeKey="tag" searchParams={searchParams} />;
}
