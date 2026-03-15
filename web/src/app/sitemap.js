import { fetchMonitor as fetchMonitorApi } from "@/lib/api";

const DEFAULT_SITE_URL = "https://omnizap.xyz";
const PAGE_LIMIT = 200;

function stripTrailingSlash(value = "") {
  return String(value || "").replace(/\/+$/, "");
}

function getSiteUrl() {
  return stripTrailingSlash(process.env.NEXT_PUBLIC_SITE_URL || DEFAULT_SITE_URL);
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
        lastModified: refined.lastSeenAt || item.timestamp || new Date().toISOString(),
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
      lastModified: item.lastSeenAt || new Date().toISOString(),
    }))
    .filter((item) => item.path && item.path.includes("/"));
}

export default async function sitemap() {
  const siteUrl = getSiteUrl();
  const nowIso = new Date().toISOString();
  const entries = [
    { path: "/", lastModified: nowIso },
    { path: "/noticias", lastModified: nowIso },
    { path: "/tendencias", lastModified: nowIso },
    { path: "/franquias", lastModified: nowIso },
    { path: "/fontes", lastModified: nowIso },
    { path: "/anime", lastModified: nowIso },
    { path: "/personagem", lastModified: nowIso },
    { path: "/estudio", lastModified: nowIso },
    { path: "/tag", lastModified: nowIso },
    { path: "/api", lastModified: nowIso },
    { path: "/sobre", lastModified: nowIso },
    { path: "/privacidade", lastModified: nowIso },
    { path: "/termos", lastModified: nowIso },
    { path: "/contato", lastModified: nowIso },
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
    deduped.set(entry.path, entry.lastModified || nowIso);
  }

  return Array.from(deduped.entries()).map(([path, lastModified]) => ({
    url: `${siteUrl}${path}`,
    lastModified,
    changeFrequency: path.startsWith("/noticias/") ? "hourly" : "daily",
    priority: path === "/" ? 1 : 0.7,
  }));
}
