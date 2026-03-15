import { SeoEntityIndexView } from "@/components/seo-entity-views";

export const metadata = {
  title: "Tags | OmniZap Anime Radar",
  description:
    "Índice de tags e temas recorrentes com páginas automáticas para ampliar cobertura editorial e SEO.",
  alternates: {
    canonical: "/tag",
  },
};

export const dynamic = "force-dynamic";

export default async function TagIndexPage({ searchParams }) {
  return <SeoEntityIndexView routeKey="tag" searchParams={searchParams} />;
}
