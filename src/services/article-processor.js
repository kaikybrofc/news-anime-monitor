const cheerio = require("cheerio");

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

function extractImageFromHtml(html) {
  const $ = cheerio.load(html);
  const ogImage =
    $('meta[property="og:image"]').attr("content") ||
    $('meta[name="twitter:image"]').attr("content");
  if (ogImage) return ogImage.trim();

  const featured =
    $(".featured-img").first().attr("data-lazy-src") ||
    $(".featured-img").first().attr("src");
  if (featured) return featured.trim();

  const contentImage =
    $(".entry-content img").first().attr("data-lazy-src") ||
    $(".entry-content img").first().attr("src");
  if (contentImage) return contentImage.trim();

  return "";
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
    image: candidate.image || "",
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
  const extractedImage = extractImageFromHtml(html);
  const image = candidate.image || extractedImage || "";
  const name = resolveArticleName(candidate, html);

  if (!image) {
    logger.warn(`[Imagem] Nenhuma imagem encontrada: ${candidate.url}`);
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
