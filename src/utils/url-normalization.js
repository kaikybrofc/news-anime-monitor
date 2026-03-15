function normalizeHost(hostname) {
  return String(hostname || "")
    .trim()
    .toLowerCase()
    .replace(/^www\./, "");
}

function normalizePathname(pathname) {
  const raw = String(pathname || "/").trim();
  if (!raw || raw === "/") return "/";

  const withLeadingSlash = raw.startsWith("/") ? raw : `/${raw}`;
  const collapsed = withLeadingSlash.replace(/\/+/g, "/");

  if (collapsed.length > 1 && collapsed.endsWith("/")) {
    return collapsed.slice(0, -1);
  }

  return collapsed;
}

function normalizeSearchParams(searchParams, keepSearchParams = []) {
  if (!keepSearchParams.length) {
    return "";
  }

  const allowed = new Set(
    keepSearchParams.map((name) => String(name || "").toLowerCase())
  );

  const filtered = new URLSearchParams();

  for (const [key, value] of searchParams.entries()) {
    if (!allowed.has(String(key || "").toLowerCase())) continue;
    filtered.append(key, value);
  }

  const serialized = filtered.toString();
  return serialized ? `?${serialized}` : "";
}

function normalizeArticleUrl(rawUrl, options = {}) {
  const {
    baseUrl = "",
    forceHttps = true,
    keepSearchParams = [],
  } = options;

  try {
    const resolved = baseUrl ? new URL(rawUrl, baseUrl) : new URL(rawUrl);

    if (!["http:", "https:"].includes(resolved.protocol)) {
      return null;
    }

    resolved.hash = "";
    resolved.hostname = normalizeHost(resolved.hostname);

    if (forceHttps && resolved.protocol === "http:") {
      resolved.protocol = "https:";
    }

    resolved.pathname = normalizePathname(resolved.pathname);
    resolved.search = normalizeSearchParams(
      resolved.searchParams,
      keepSearchParams
    );

    const canonicalUrl = resolved.toString();

    return {
      url: canonicalUrl,
      canonicalUrl,
      hostname: normalizeHost(resolved.hostname),
      pathname: normalizePathname(resolved.pathname),
      origin: `${resolved.protocol}//${normalizeHost(resolved.hostname)}`,
      search: resolved.search || "",
    };
  } catch {
    return null;
  }
}

function matchesDomain(hostname, domains) {
  const normalizedHost = normalizeHost(hostname);
  const normalizedDomains = (domains || []).map(normalizeHost).filter(Boolean);

  if (!normalizedDomains.length) {
    return false;
  }

  return normalizedDomains.some(
    (domain) =>
      normalizedHost === domain || normalizedHost.endsWith(`.${domain}`)
  );
}

function matchesAllowedPrefixes(pathname, prefixes = []) {
  if (!prefixes.length) return true;

  const normalizedPath = String(pathname || "").toLowerCase();
  return prefixes.some((prefix) =>
    normalizedPath.startsWith(String(prefix || "").toLowerCase())
  );
}

function matchesExcludedPrefixes(pathname, prefixes = []) {
  const normalizedPath = String(pathname || "").toLowerCase();
  return prefixes.some((prefix) =>
    normalizedPath.startsWith(String(prefix || "").toLowerCase())
  );
}

module.exports = {
  normalizeHost,
  normalizePathname,
  normalizeArticleUrl,
  matchesDomain,
  matchesAllowedPrefixes,
  matchesExcludedPrefixes,
};
