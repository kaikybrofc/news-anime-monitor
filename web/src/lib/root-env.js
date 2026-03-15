import fs from "node:fs";
import path from "node:path";

const CANDIDATE_ENV_PATHS = [
  path.resolve(process.cwd(), ".env"),
  path.resolve(process.cwd(), "../.env"),
  path.resolve(process.cwd(), "../../.env"),
];

let cachedEnvMap = null;
let cachedAtMs = 0;
const CACHE_TTL_MS = 60 * 1000;

function parseEnvValue(rawValue = "") {
  const trimmed = String(rawValue || "").trim();
  if (!trimmed) return "";

  if (
    (trimmed.startsWith("\"") && trimmed.endsWith("\"")) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }

  return trimmed;
}

function parseEnvFile(content = "") {
  const map = {};
  const lines = String(content || "").split(/\r?\n/);

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex <= 0) return;

    const key = trimmed.slice(0, separatorIndex).trim();
    if (!key) return;

    const rawValue = trimmed.slice(separatorIndex + 1);
    map[key] = parseEnvValue(rawValue);
  });

  return map;
}

function loadRootEnvMap() {
  const nowMs = Date.now();
  if (cachedEnvMap && nowMs - cachedAtMs < CACHE_TTL_MS) {
    return cachedEnvMap;
  }

  for (const envPath of CANDIDATE_ENV_PATHS) {
    try {
      if (!fs.existsSync(envPath)) continue;
      const content = fs.readFileSync(envPath, "utf8");
      cachedEnvMap = parseEnvFile(content);
      cachedAtMs = nowMs;
      return cachedEnvMap;
    } catch {
      // ignora falhas pontuais e tenta o próximo caminho
    }
  }

  cachedEnvMap = {};
  cachedAtMs = nowMs;
  return cachedEnvMap;
}

export function getEnvValue(name, fallback = "") {
  const processValue = String(process.env[name] || "").trim();
  if (processValue) {
    return processValue;
  }

  const envMap = loadRootEnvMap();
  const fileValue = String(envMap[name] || "").trim();
  return fileValue || fallback;
}
