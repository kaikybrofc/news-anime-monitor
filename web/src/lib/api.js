const DEFAULT_MONITOR_API_BASE_URLS = [
  "http://127.0.0.1:3001",
  "http://127.0.0.1:3000",
];
const REQUEST_TIMEOUT_MS = 10000;

function stripTrailingSlash(value) {
  return String(value || "").replace(/\/+$/, "");
}

function getConfiguredMonitorApiBaseUrl() {
  const envBase =
    process.env.NEWS_MONITOR_API_URL ||
    process.env.MONITOR_API_URL ||
    process.env.API_BASE_URL;

  return stripTrailingSlash(envBase || "");
}

export function getMonitorApiBaseUrls() {
  const configured = getConfiguredMonitorApiBaseUrl();
  if (configured) return [configured];
  return DEFAULT_MONITOR_API_BASE_URLS.slice();
}

export function getMonitorApiBaseUrl() {
  return getMonitorApiBaseUrls()[0];
}

function appendQueryParams(url, query = {}) {
  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null) return;

    const parsed = Array.isArray(value) ? value[0] : value;
    const text = String(parsed).trim();
    if (!text) return;

    url.searchParams.set(key, text);
  });
}

export async function fetchMonitor(pathname, query = {}) {
  const normalizedPath = pathname.startsWith("/") ? pathname : `/${pathname}`;
  const configuredBaseUrl = getConfiguredMonitorApiBaseUrl();
  const baseUrls = getMonitorApiBaseUrls();
  const allowFallback = !configuredBaseUrl;
  const attemptErrors = [];

  for (let index = 0; index < baseUrls.length; index += 1) {
    const baseUrl = baseUrls[index];
    const url = new URL(normalizedPath, `${baseUrl}/`);
    appendQueryParams(url, query);

    let response;
    try {
      response = await fetch(url.toString(), {
        cache: "no-store",
        next: { revalidate: 0 },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      attemptErrors.push(
        `Falha de rede em ${baseUrl}${normalizedPath}: ${error.message}`
      );

      if (allowFallback && index < baseUrls.length - 1) {
        continue;
      }

      throw new Error(attemptErrors.join(" | "));
    }

    if (!response.ok) {
      let details = "";
      try {
        const json = await response.json();
        details = json?.error ? ` ${json.error}` : "";
      } catch {
        details = "";
      }

      const statusMessage = `Erro ${response.status} em ${baseUrl}${normalizedPath}.${details}`.trim();
      attemptErrors.push(statusMessage);

      const shouldRetryWithFallback =
        allowFallback && index < baseUrls.length - 1 && response.status >= 500;

      if (shouldRetryWithFallback) {
        continue;
      }

      const error = new Error(attemptErrors.join(" | "));
      error.status = response.status;
      throw error;
    }

    return response.json();
  }

  throw new Error(
    `Falha ao acessar ${normalizedPath}. Tentativas: ${attemptErrors.join(" | ")}`
  );
}

export function readQueryString(searchParams, key, fallback = "") {
  if (!searchParams || !key) return fallback;
  const value = searchParams[key];
  if (Array.isArray(value)) return String(value[0] || fallback);
  if (value === undefined || value === null) return fallback;
  return String(value);
}

export function readQueryInt(searchParams, key, fallback) {
  const raw = readQueryString(searchParams, key, "");
  if (!String(raw).trim()) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.floor(parsed);
}

export function clampInt(value, minimum, maximum, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(minimum, Math.min(maximum, Math.floor(parsed)));
}
