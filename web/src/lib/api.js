const DEFAULT_MONITOR_API_BASE_URL = "http://127.0.0.1:3001";
const REQUEST_TIMEOUT_MS = 10000;

function stripTrailingSlash(value) {
  return String(value || "").replace(/\/+$/, "");
}

export function getMonitorApiBaseUrl() {
  const envBase =
    process.env.NEWS_MONITOR_API_URL ||
    process.env.MONITOR_API_URL ||
    process.env.API_BASE_URL;

  return stripTrailingSlash(envBase || DEFAULT_MONITOR_API_BASE_URL);
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
  const baseUrl = getMonitorApiBaseUrl();
  const normalizedPath = pathname.startsWith("/") ? pathname : `/${pathname}`;
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
    throw new Error(`Falha de rede ao acessar ${url.pathname}: ${error.message}`);
  }

  if (!response.ok) {
    let details = "";
    try {
      const json = await response.json();
      details = json?.error ? ` ${json.error}` : "";
    } catch {
      details = "";
    }

    const error = new Error(
      `Erro ${response.status} em ${url.pathname}.${details}`.trim()
    );
    error.status = response.status;
    throw error;
  }

  return response.json();
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
