import { SeoEntityDetailView } from "@/components/seo-entity-views";
import { fetchMonitor } from "@/lib/api";
import { titleFromSlug } from "@/lib/formatters";

export const dynamic = "force-dynamic";

async function resolveAnimeMetadata(slug = "") {
  const normalizedSlug = String(slug || "").trim().toLowerCase();
  const fallbackTitle = titleFromSlug(normalizedSlug) || "Anime";

  if (!normalizedSlug) {
    return { title: fallbackTitle, shouldNoIndex: true };
  }

  try {
    const payload = await fetchMonitor(`/seo/anime/${encodeURIComponent(normalizedSlug)}`, {
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
  const resolved = await resolveAnimeMetadata(slug);
  const canonicalPath = slug ? `/anime/${encodeURIComponent(slug)}` : "/anime";

  return {
    title: `${resolved.title} | Anime | OmniZap Anime Radar`,
    description: `Página programática com notícias e cobertura sobre ${resolved.title}.`,
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

export default async function AnimeDetailPage(props) {
  const resolvedProps = await props;
  const resolvedParams = await resolvedProps?.params;
  const searchParams = resolvedProps?.searchParams;

  return (
    <SeoEntityDetailView
      routeKey="anime"
      params={resolvedParams}
      searchParams={searchParams}
    />
  );
}
