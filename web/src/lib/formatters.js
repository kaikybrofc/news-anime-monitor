export function formatDateTime(value) {
  if (!value) return "sem data";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "sem data";

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(parsed);
}

export function formatNumber(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "0";
  return new Intl.NumberFormat("pt-BR").format(parsed);
}

export function titleFromSlug(slug = "") {
  return String(slug || "")
    .split("-")
    .filter(Boolean)
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(" ");
}

function humanizeNormalizedTitle(value = "") {
  const raw = String(value || "").trim();
  if (!raw) return "";
  return raw
    .split(/\s+/)
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(" ");
}

export function getArticleTitle(article = {}) {
  const refined = article?.refined || {};
  const explicitTitle = String(refined.name || article.name || "").trim();
  if (explicitTitle) return explicitTitle;

  const normalizedTitle = humanizeNormalizedTitle(refined.titleNormalized || "");
  if (normalizedTitle) return normalizedTitle;

  return String(refined.canonicalUrl || refined.url || article.id || "Sem titulo");
}

export function getArticleUrl(article = {}) {
  const refined = article?.refined || {};
  return String(refined.canonicalUrl || refined.url || article.url || "").trim();
}

export function summarizeText(value = "", maxLength = 220) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1)}...`;
}

