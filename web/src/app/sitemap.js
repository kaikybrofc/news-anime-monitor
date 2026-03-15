const DEFAULT_SITE_URL = "https://omnizap.xyz";
const DEFAULT_MONITOR_API_BASE_URL = "http://127.0.0.1:3001";
const PAGE_LIMIT = 200;

function stripTrailingSlash(value = "") {
  return String(value || "").replace(/\/+$/, "");
}

function getSiteUrl() {
  return stripTrailingSlash(process.env.NEXT_PUBLIC_SITE_URL || DEFAULT_SITE_URL);
}

function getMonitorApiBaseUrl() {
  return stripTrailingSlash(
    process.env.NEWS_MONITOR_API_URL ||
      process.env.MONITOR_API_URL ||
      process.env.API_BASE_URL ||
      DEFAULT_MONITOR_API_BASE_URL
  );
}

async function fetchMonitor(pathname, query = {}) {
  const baseUrl = getMonitorApiBaseUrl();
  const url = new URL(pathname.startsWith("/") ? pathname : `/${pathname}`, `${baseUrl}/`);

  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    url.searchParams.set(key, String(value));
  });

  const response = await fetch(url.toString(), {
    cache: "no-store",
    next: { revalidate: 0 },
  });

  if (!response.ok) {
    throw new Error(`Falha ao carregar ${url.pathname}: ${response.status}`);
  }

  return response.json();
}

async function fetchAllArticlePaths() {
  const paths = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const payload = await fetchMonitor("/articles", {
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
  const payload = await fetchMonitor("/seo/entities", {
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
