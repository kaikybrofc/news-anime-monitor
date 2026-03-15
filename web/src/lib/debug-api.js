import { getMonitorApiBaseUrl } from "@/lib/api";
import { getEnvValue } from "@/lib/root-env";

const REQUEST_TIMEOUT_MS = 12000;

function buildDebugHeaders() {
  const token =
    getEnvValue("DEBUG_API_TOKEN") || getEnvValue("DEBUG_SOURCES_TOKEN");

  if (!token) return {};
  return {
    "x-debug-token": token,
  };
}

export async function fetchDebugMonitor(pathname) {
  const baseUrl = getMonitorApiBaseUrl();
  const normalizedPath = pathname.startsWith("/") ? pathname : `/${pathname}`;
  const url = new URL(normalizedPath, `${baseUrl}/`);

  let response;
  try {
    response = await fetch(url.toString(), {
      cache: "no-store",
      next: { revalidate: 0 },
      headers: buildDebugHeaders(),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    throw new Error(`Falha de rede ao acessar ${url.pathname}: ${error.message}`);
  }

  if (!response.ok) {
    let details = "";
    try {
      const payload = await response.json();
      details = payload?.error ? ` ${payload.error}` : "";
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
