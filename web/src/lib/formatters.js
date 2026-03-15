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

function normalizeToAscii(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function slugify(value = "", maxLength = 80) {
  const cleaned = normalizeToAscii(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-")
    .trim();

  if (!cleaned) return "noticia";
  if (cleaned.length <= maxLength) return cleaned;

  return cleaned.slice(0, maxLength).replace(/-+$/g, "");
}

function toDateSlug(value) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "sem-data";

  const year = parsed.getUTCFullYear();
  const month = String(parsed.getUTCMonth() + 1).padStart(2, "0");
  const day = String(parsed.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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

  return String(refined.canonicalUrl || refined.url || article.id || "Sem título");
}

export function getArticleUrl(article = {}) {
  const refined = article?.refined || {};
  return String(refined.canonicalUrl || refined.url || article.url || "").trim();
}

export function getArticleImageUrl(article = {}) {
  const refined = article?.refined || {};
  return String(refined.image || article.image || "").trim();
}

export function extractArticleIdFromNewsParam(param = "") {
  const raw = String(param || "").trim();
  if (!raw) return "";

  const marker = "--";
  if (raw.includes(marker)) {
    const maybeId = raw.split(marker).pop()?.trim();
    if (maybeId) return maybeId;
  }

  return raw;
}

export function isLikelyArticleId(value = "") {
  return /^[a-f0-9]{40}$/i.test(String(value || "").trim());
}

function getArticlePublishedAt(article = {}) {
  const refined = article?.refined || {};
  return refined.publishedAt || article.publishedAt || article.timestamp || "";
}

export function getArticleSeoSlug(article = {}) {
  const refined = article?.refined || {};
  const providedSlug = String(refined.newsSlug || "").trim();
  if (providedSlug) return providedSlug;

  const title = getArticleTitle(article);
  const titleSlug = slugify(title, 84);
  const dateSlug = toDateSlug(getArticlePublishedAt(article));
  return `${titleSlug}-${dateSlug}`;
}

export function getArticleDetailPath(article = {}) {
  const seoSlug = getArticleSeoSlug(article);
  if (!seoSlug) return "/noticias";
  return `/noticias/${seoSlug}`;
}

export function summarizeText(value = "", maxLength = 220) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1)}...`;
}
