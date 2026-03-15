import { SeoEntityDetailView } from "@/components/seo-entity-views";
import { fetchMonitor } from "@/lib/api";
import { titleFromSlug } from "@/lib/formatters";

export const dynamic = "force-dynamic";

async function resolveStudioMetadata(slug = "") {
  const normalizedSlug = String(slug || "").trim().toLowerCase();
  const fallbackTitle = titleFromSlug(normalizedSlug) || "Estúdio";

  if (!normalizedSlug) {
    return { title: fallbackTitle, shouldNoIndex: true };
  }

  try {
    const payload = await fetchMonitor(`/seo/studio/${encodeURIComponent(normalizedSlug)}`, {
      limit: 1,
      offset: 0,
    });
    const total = Number(payload?.total || 0);
    const entityTitle = String(payload?.entity?.name || fallbackTitle).trim() || fallbackTitle;

    return {
      title: entityTitle,
      shouldNoIndex: total <= 0,
    };
  } catch (error) {
    if (error?.status === 404) {
      return { title: fallbackTitle, shouldNoIndex: true };
    }

    return { title: fallbackTitle, shouldNoIndex: false };
  }
}

export async function generateMetadata(props) {
  const resolvedProps = await props;
  const resolvedParams = await resolvedProps?.params;
  const slug = String(resolvedParams?.slug || "").trim().toLowerCase();
  const resolved = await resolveStudioMetadata(slug);
  const canonicalPath = slug ? `/estudio/${encodeURIComponent(slug)}` : "/estudio";

  return {
    title: `${resolved.title} | Estúdio | OmniZap Anime Radar`,
    description: `Página programática com cobertura de notícias do estúdio ${resolved.title}.`,
    alternates: {
      canonical: canonicalPath,
    },
    robots: resolved.shouldNoIndex
      ? {
          index: false,
          follow: true,
        }
      : undefined,
  };
}

export default async function EstudioDetailPage(props) {
  const resolvedProps = await props;
  const resolvedParams = await resolvedProps?.params;
  const searchParams = resolvedProps?.searchParams;

  return (
    <SeoEntityDetailView
      routeKey="estudio"
      params={resolvedParams}
      searchParams={searchParams}
    />
  );
}
