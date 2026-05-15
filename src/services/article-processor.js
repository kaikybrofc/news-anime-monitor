const cheerio = require("cheerio");
const axios = require("axios");

const { summarizeHtml } = require("./summarizer.js");
const logger = require("../utils/logger.js");
const { getWithRetry } = require("../utils/http.js");
const { checkRobotsForUrl } = require("../utils/robots.js");
const {
  isLikelyUrl,
  inferTitleFromUrl,
  extractTitleFromHtml,
} = require("../utils/article-utils.js");
const { buildProcessedArticle } = require("../pipeline/enrichment.js");

function normalizeText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function escapeXml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function resolveUrl(rawUrl, baseUrl) {
  try {
    const resolved = new URL(String(rawUrl || ""), String(baseUrl || ""));
    if (!["http:", "https:"].includes(resolved.protocol)) return "";
    return resolved.toString();
  } catch {
    return "";
  }
}

function isValidImageCandidate(url) {
  const value = String(url || "").trim();
  if (!value) return false;
  if (/^data:/i.test(value)) return false;
  return /^https?:\/\//i.test(value);
}

function extractJsonLdImageCandidates($) {
  const out = [];

  $("script[type='application/ld+json']").each((_, node) => {
    const raw = $(node).html();
    if (!raw) return;

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return;
    }

    const queue = Array.isArray(parsed) ? [...parsed] : [parsed];
    while (queue.length) {
      const current = queue.shift();
      if (!current || typeof current !== "object") continue;

      const image = current.image;
      if (typeof image === "string") {
        out.push(image);
      } else if (Array.isArray(image)) {
        image.forEach((entry) => {
          if (typeof entry === "string") out.push(entry);
          if (entry && typeof entry === "object" && typeof entry.url === "string") {
            out.push(entry.url);
          }
        });
      } else if (image && typeof image === "object" && typeof image.url === "string") {
        out.push(image.url);
      }

      Object.values(current).forEach((value) => {
        if (value && typeof value === "object") {
          queue.push(value);
        }
      });
    }
  });

  return out;
}

function extractImageCandidatesFromHtml(html, articleUrl = "") {
  const $ = cheerio.load(html);
  const candidates = [
    $('meta[property="og:image"]').attr("content"),
    $('meta[property="og:image:secure_url"]').attr("content"),
    $('meta[name="twitter:image"]').attr("content"),
    $('meta[name="twitter:image:src"]').attr("content"),
    $('meta[itemprop="image"]').attr("content"),
    $("link[rel='image_src']").attr("href"),
    $(".featured-img").first().attr("data-lazy-src"),
    $(".featured-img").first().attr("data-src"),
    $(".featured-img").first().attr("src"),
    $(".entry-content img").first().attr("data-lazy-src"),
    $(".entry-content img").first().attr("data-src"),
    $(".entry-content img").first().attr("src"),
    $("article img").first().attr("data-lazy-src"),
    $("article img").first().attr("data-src"),
    $("article img").first().attr("src"),
    $("main img").first().attr("data-lazy-src"),
    $("main img").first().attr("data-src"),
    $("main img").first().attr("src"),
  ];

  candidates.push(...extractJsonLdImageCandidates($));

  const seen = new Set();
  const out = [];
  for (const candidate of candidates) {
    const normalized = resolveUrl(normalizeText(candidate), articleUrl);
    if (!isValidImageCandidate(normalized)) continue;
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }

  return out;
}

async function isReachableImageUrl(url, sourceConfig) {
  try {
    const headers = {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      ...(sourceConfig?.requestHeaders || {}),
    };

    const response = await axios.head(url, {
      timeout: 9000,
      maxRedirects: 5,
      headers,
      validateStatus: () => true,
    });

    if (response.status >= 400) return false;
    const contentType = String(response.headers?.["content-type"] || "").toLowerCase();
    if (!contentType.startsWith("image/")) return false;
    return hasValidImageSignature(url, headers);
  } catch {
    return false;
  }
}

function hasKnownImageMagicHeader(buffer) {
  if (!buffer || buffer.length < 12) return false;

  const isPng =
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47;
  if (isPng) return true;

  const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (isJpeg) return true;

  const isGif =
    buffer[0] === 0x47 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x38;
  if (isGif) return true;

  const isWebp =
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50;
  if (isWebp) return true;

  const isAvif =
    buffer[4] === 0x66 &&
    buffer[5] === 0x74 &&
    buffer[6] === 0x79 &&
    buffer[7] === 0x70 &&
    buffer.includes(0x61) &&
    buffer.includes(0x76) &&
    buffer.includes(0x69) &&
    buffer.includes(0x66);
  if (isAvif) return true;

  const asText = buffer.toString("utf8").trim().toLowerCase();
  if (asText.startsWith("<svg")) return true;

  return false;
}

async function hasValidImageSignature(url, headers) {
  try {
    const response = await axios.get(url, {
      timeout: 9000,
      maxRedirects: 5,
      headers: {
        ...headers,
        Range: "bytes=0-4095",
      },
      responseType: "arraybuffer",
      validateStatus: () => true,
    });

    if (response.status >= 400) return false;
    const bytes = Buffer.from(response.data || []);
    if (!bytes.length) return false;
    return hasKnownImageMagicHeader(bytes);
  } catch {
    return false;
  }
}

function buildFallbackImageSvgDataUrl(name = "", sourceName = "") {
  const title = escapeXml(normalizeText(name) || "Noticia de anime");
  const source = escapeXml(normalizeText(sourceName) || "OmniZap Anime Radar");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" role="img" aria-label="${title}"><defs><linearGradient id="bg" x1="0" x2="1" y1="0" y2="1"><stop offset="0%" stop-color="#0b1220"/><stop offset="100%" stop-color="#1e293b"/></linearGradient></defs><rect width="1200" height="630" fill="url(#bg)"/><circle cx="1040" cy="110" r="180" fill="#e11d48" opacity="0.20"/><circle cx="140" cy="560" r="220" fill="#38bdf8" opacity="0.16"/><text x="80" y="118" fill="#94a3b8" font-family="Arial, Helvetica, sans-serif" font-size="28" font-weight="700">OMNIZAP • IMAGEM PADRAO</text><foreignObject x="80" y="170" width="1040" height="320"><div xmlns="http://www.w3.org/1999/xhtml" style="color:#f8fafc;font-family:Arial, Helvetica, sans-serif;font-size:56px;font-weight:800;line-height:1.15;display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden;">${title}</div></foreignObject><text x="80" y="570" fill="#cbd5e1" font-family="Arial, Helvetica, sans-serif" font-size="30">${source}</text></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

async function resolveArticleImage(candidate, html) {
  const imageCandidates = extractImageCandidatesFromHtml(html, candidate.url);
  const preferred = resolveUrl(candidate.image, candidate.url);
  const merged = preferred ? [preferred, ...imageCandidates] : imageCandidates;
  const seen = new Set();

  for (const imageUrl of merged) {
    if (!isValidImageCandidate(imageUrl) || seen.has(imageUrl)) continue;
    seen.add(imageUrl);
    const reachable = await isReachableImageUrl(imageUrl, candidate.sourceConfig);
    if (reachable) return imageUrl;
  }

  return buildFallbackImageSvgDataUrl(candidate.name || "", candidate.sourceName || "");
}

function normalizeNameKey(value) {
  return String(value || "").trim().toLowerCase();
}

function resolveArticleName(articleInfo, html) {
  const providedName = String(articleInfo?.name || "").trim();
  const inferredName = inferTitleFromUrl(articleInfo.url);

  const hasStrongProvidedName =
    providedName &&
    !isLikelyUrl(providedName) &&
    normalizeNameKey(providedName) !== normalizeNameKey(inferredName);

  if (hasStrongProvidedName) {
    return providedName;
  }

  const extractedTitle = extractTitleFromHtml(html, articleInfo.sourceConfig);
  if (extractedTitle) {
    return extractedTitle;
  }

  return providedName || inferredName;
}

async function evaluateFetchPermission(url, sourceConfig, context) {
  const result = await checkRobotsForUrl(url, {
    headers: sourceConfig?.requestHeaders,
    context,
  });

  if (result.allowed) {
    return result;
  }

  const matchedRule = result?.matchedRule;
  const ruleInfo = matchedRule
    ? ` (${matchedRule.type}: ${matchedRule.path})`
    : "";

  logger.warn(`[${context}] URL bloqueada por robots.txt para fetch: ${url}${ruleInfo}`);
  return result;
}

function buildRestrictedArticle(candidate, permissionResult, seenAt) {
  const name = String(candidate.name || "").trim() || inferTitleFromUrl(candidate.url);

  return buildProcessedArticle({
    candidate: {
      ...candidate,
      fetchRestricted: true,
      ingestionMeta: {
        ...(candidate.ingestionMeta || {}),
        fetchRestricted: true,
        fetchRestrictionReason: permissionResult?.reason || "robots_disallowed",
      },
    },
    name,
    image:
      candidate.image ||
      buildFallbackImageSvgDataUrl(name, candidate.sourceName || ""),
    summary: candidate.summary || "",
    seenAt,
  });
}

async function processArticleCandidate(
  candidate,
  seenAt = new Date().toISOString(),
  options = {}
) {
  const sourceTag = candidate.sourceName ? `[${candidate.sourceName}] ` : "";
  logger.info(`${sourceTag}Processando: ${candidate.name || candidate.url}`);

  const permissionResult = await evaluateFetchPermission(
    candidate.url,
    candidate.sourceConfig,
    `${candidate.sourceName || "Artigo"}/Fetch`
  );

  if (!permissionResult.allowed) {
    return buildRestrictedArticle(candidate, permissionResult, seenAt);
  }

  const articlePageResponse = await getWithRetry(candidate.url, {
    context: `${candidate.sourceName || "Artigo"}/Fetch`,
    headers: candidate.sourceConfig?.requestHeaders,
  });

  const html = articlePageResponse.data;
  const summary = await summarizeHtml(html, {
    onAutoRetry: options.onSummaryRetry,
  });
  const name = resolveArticleName(candidate, html);
  const image = await resolveArticleImage({ ...candidate, name }, html);

  if (String(image).startsWith("data:image/svg+xml")) {
    logger.warn(`[Imagem] Fallback SVG aplicado: ${candidate.url}`);
  }

  return buildProcessedArticle({
    candidate,
    name,
    image,
    summary,
    seenAt,
  });
}

async function processWithConcurrency(items, worker, concurrency) {
  if (!items.length) return [];

  const results = new Array(items.length);
  const limit = Math.max(1, Math.min(concurrency, items.length));
  let nextIndex = 0;

  async function runWorker() {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;

      if (index >= items.length) {
        return;
      }

      try {
        results[index] = await worker(items[index]);
      } catch (error) {
        logger.error(
          `Erro ao processar o artigo "${items[index]?.name || items[index]?.url}":`,
          error?.message || error
        );
        results[index] = null;
      }
    }
  }

  await Promise.all(Array.from({ length: limit }, () => runWorker()));
  return results.filter(Boolean);
}

module.exports = {
  processArticleCandidate,
  processWithConcurrency,
};
