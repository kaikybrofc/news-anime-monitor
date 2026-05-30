import { fetchMonitor as fetchMonitorApi } from "@/lib/api";

const DEFAULT_SITE_URL = "https://animeradar.shop";
const PAGE_LIMIT = 200;
const DEFAULT_LASTMOD_ISO = process.env.SITEMAP_DEFAULT_LASTMOD || "";

function stripTrailingSlash(value = "") {
  return String(value || "").replace(/\/+$/, "");
}

function getSiteUrl() {
  return stripTrailingSlash(process.env.NEXT_PUBLIC_SITE_URL || DEFAULT_SITE_URL);
}

function normalizeIsoDate(value) {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
}

async function fetchAllArticlePaths() {
  const paths = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const payload = await fetchMonitorApi("/articles", {
      limit: PAGE_LIMIT,
      offset,
    });

    const items = Array.isArray(payload?.items) ? payload.items : [];
    for (const item of items) {
      const refined = item?.refined || {};
      const newsSlug = String(refined.newsSlug || "").trim();
      if (!newsSlug) continue;
      paths.push({
        path: `/noticias/${newsSlug}`,
        lastModified: normalizeIsoDate(refined.lastSeenAt || item.timestamp),
      });
    }

    hasMore = Boolean(payload?.hasMore);
    offset += PAGE_LIMIT;

    if (!items.length) break;
  }

  return paths;
}

async function fetchEntityPaths(type, routeBase) {
  const payload = await fetchMonitorApi("/seo/entities", {
    type,
    top: 1000,
  });

  const items = Array.isArray(payload?.items) ? payload.items : [];
  return items
    .map((item) => ({
      path: `${routeBase}/${item.slug}`,
      lastModified: normalizeIsoDate(item.lastSeenAt),
    }))
    .filter((item) => item.path && item.path.includes("/"));
}

export default async function sitemap() {
  const siteUrl = getSiteUrl();
  const fallbackIso = normalizeIsoDate(DEFAULT_LASTMOD_ISO);
  const entries = [
    { path: "/", lastModified: fallbackIso },
    { path: "/noticias", lastModified: fallbackIso },
    { path: "/tendencias", lastModified: fallbackIso },
    { path: "/calendario", lastModified: fallbackIso },
    { path: "/franquias", lastModified: fallbackIso },
    { path: "/fontes", lastModified: fallbackIso },
    { path: "/anime", lastModified: fallbackIso },
    { path: "/personagem", lastModified: fallbackIso },
    { path: "/estudio", lastModified: fallbackIso },
    { path: "/tag", lastModified: fallbackIso },
    { path: "/api", lastModified: fallbackIso },
    { path: "/sobre", lastModified: fallbackIso },
    { path: "/privacidade", lastModified: fallbackIso },
    { path: "/termos", lastModified: fallbackIso },
    { path: "/contato", lastModified: fallbackIso },
  ];

  try {
    const [articleEntries, animeEntries, characterEntries, studioEntries, tagEntries] =
      await Promise.all([
        fetchAllArticlePaths(),
        fetchEntityPaths("anime", "/anime"),
        fetchEntityPaths("character", "/personagem"),
        fetchEntityPaths("studio", "/estudio"),
        fetchEntityPaths("tag", "/tag"),
      ]);

    entries.push(...articleEntries, ...animeEntries, ...characterEntries, ...studioEntries, ...tagEntries);
  } catch {
    // Mantém o sitemap mínimo disponível mesmo em caso de falha temporária da API.
  }

  const deduped = new Map();
  for (const entry of entries) {
    if (!entry?.path) continue;
    deduped.set(entry.path, normalizeIsoDate(entry.lastModified));
  }

  return Array.from(deduped.entries()).map(([path, lastModified]) => {
    const item = {
      url: `${siteUrl}${path}`,
      changeFrequency: path.startsWith("/noticias/") ? "hourly" : "daily",
      priority: path === "/" ? 1 : 0.7,
    };

    if (lastModified) {
      item.lastModified = lastModified;
    }

    return item;
  });
}
