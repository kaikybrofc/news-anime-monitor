const DEFAULT_MONITOR_API_BASE_URLS = [
  "http://127.0.0.1:3001",
  "http://127.0.0.1:3000",
];
const REQUEST_TIMEOUT_MS = 10000;
const RATE_LIMIT_RETRY_ATTEMPTS = 2;
const RATE_LIMIT_RETRY_BASE_DELAY_MS = 350;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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
      if (response.status === 429) {
        let handled = false;

        if (allowFallback && index < baseUrls.length - 1) {
          attemptErrors.push(`Erro 429 em ${baseUrl}${normalizedPath}. Tentando fallback...`);
          continue;
        }

        for (let retry = 0; retry < RATE_LIMIT_RETRY_ATTEMPTS; retry += 1) {
          const delayMs = RATE_LIMIT_RETRY_BASE_DELAY_MS * (retry + 1);
          await wait(delayMs);

          let retryResponse;
          try {
            retryResponse = await fetch(url.toString(), {
              cache: "no-store",
              next: { revalidate: 0 },
              signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
            });
          } catch (error) {
            attemptErrors.push(`Falha de rede após 429 em ${baseUrl}${normalizedPath}: ${error.message}`);
            break;
          }

          if (retryResponse.ok) {
            return retryResponse.json();
          }

          if (retryResponse.status !== 429) {
            response = retryResponse;
            handled = true;
            break;
          }

          if (retry + 1 === RATE_LIMIT_RETRY_ATTEMPTS) {
            attemptErrors.push(`Erro 429 em ${baseUrl}${normalizedPath} após ${RATE_LIMIT_RETRY_ATTEMPTS} tentativas.`);
          }
        }

        if (!handled) {
          const error = new Error(attemptErrors.join(" | ") || `Erro 429 em ${baseUrl}${normalizedPath}.`);
          error.status = 429;
          throw error;
        }
      }

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
