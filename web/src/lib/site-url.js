function normalizeBaseUrl(value = "") {
  const raw = String(value || "").trim();
  if (!raw) return "";

  try {
    const parsed = new URL(raw);
    return parsed.toString().replace(/\/+$/, "");
  } catch {
    return "";
  }
}

export function getSiteBaseUrl() {
  const normalized = normalizeBaseUrl(process.env.NEXT_PUBLIC_SITE_URL);
  if (normalized) return normalized;
  return "https://animeradar.shop";
}

export function toAbsoluteSiteUrl(pathname = "/") {
  const base = getSiteBaseUrl();
  const normalizedPath = String(pathname || "/").startsWith("/")
    ? String(pathname || "/")
    : `/${String(pathname || "/")}`;
  return `${base}${normalizedPath}`;
}
