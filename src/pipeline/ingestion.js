const logger = require("../utils/logger.js");
const crypto = require("crypto");
const { checkRobotsForUrl } = require("../utils/robots.js");
const { getWithRetry, toPositiveInt } = require("../utils/http.js");
const {
  extractArticlesFromHomeHtml,
  extractArticlesFromFeed,
  extractSitemapsFromIndex,
  extractUrlsFromSitemap,
  filterByDays,
  inferTitleFromUrl,
} = require("../utils/article-utils.js");

async function isSourceUrlAllowedByRobots(url, source, context) {
  const result = await checkRobotsForUrl(url, {
    headers: source?.requestHeaders,
    context,
  });

  if (result.allowed) return true;

  const matchedRule = result?.matchedRule;
  const ruleInfo = matchedRule
    ? ` (${matchedRule.type}: ${matchedRule.path})`
    : "";

  logger.warn(`[${context}] URL bloqueada por robots.txt: ${url}${ruleInfo}`);
  return false;
}

async function annotateItemsWithRobots(items, source, context) {
  const annotatedItems = [];

  for (const item of items) {
    if (!item?.url) continue;

    const result = await checkRobotsForUrl(item.url, {
      headers: source?.requestHeaders,
      context: `${context}/Article`,
    });

    const matchedRule = result?.matchedRule;
    const ruleInfo = matchedRule
      ? `${matchedRule.type}:${matchedRule.path}`
      : "";

    if (!result.allowed) {
      logger.warn(
        `[${context}] URL descoberta, mas bloqueada para fetch por robots.txt: ${item.url}${
          ruleInfo ? ` (${ruleInfo})` : ""
        }`
      );
    }

    annotatedItems.push({
      ...item,
      fetchRestricted: !result.allowed,
      ingestionMeta: {
        ...(item.ingestionMeta || {}),
        robotsAllowedForFetch: Boolean(result.allowed),
        robotsReason: result.reason || "",
        robotsRule: ruleInfo,
      },
    });
  }

  return annotatedItems;
}

function enrichSitemapNames(sitemapItems, feedItems) {
  if (!sitemapItems.length || !feedItems.length) return sitemapItems;

  const feedTitlesByUrl = new Map(
    feedItems
      .filter((item) => item.url && item.name)
      .map((item) => [item.url, item.name])
  );

  return sitemapItems.map((item) => {
    const feedTitle = feedTitlesByUrl.get(item.url);
    if (!feedTitle) return item;

    return {
      ...item,
      name: feedTitle,
    };
  });
}

function withBucket(items, source, bucket, collectedFrom) {
  return items.map((item) => ({
    ...item,
    sourceId: source.id,
    sourceName: source.name,
    sourceConfig: source,
    bucket,
    collectedFrom,
    ingestionMeta: {
      ...(item.ingestionMeta || {}),
      source: source.id,
      bucket,
      collectedFrom,
    },
  }));
}

function hashResponseBody(data) {
  try {
    const raw =
      typeof data === "string"
        ? data
        : Buffer.isBuffer(data)
          ? data
          : JSON.stringify(data || "");
    return crypto.createHash("sha256").update(String(raw)).digest("hex");
  } catch {
    return "";
  }
}

function buildFetchAudit(response, requestedUrl = "") {
  const headers = response?.headers || {};
  const statusCode = Number(response?.status || 0) || 0;
  const finalUrl = String(response?.request?.res?.responseUrl || requestedUrl || "");
  const contentType = String(headers["content-type"] || "");
  const contentLength = Number(headers["content-length"] || 0) || 0;
  const etag = String(headers.etag || "");
  const lastModified = String(headers["last-modified"] || "");
  const cacheControl = String(headers["cache-control"] || "");
  const responseHash = hashResponseBody(response?.data);

  return {
    requestedUrl: String(requestedUrl || ""),
    finalUrl,
    statusCode,
    contentType,
    contentLength,
    etag,
    lastModified,
    cacheControl,
    responseHash,
  };
}

async function collectItemsFromSource(source, options = {}) {
  const {
    daysBack,
    maxItemsPerSource,
    maxSitemapsPerSource,
    metrics,
  } = options;

  const sourceTag = `[Fonte:${source.name}]`;
  const sourceHeaders = source.requestHeaders;
  const maxItemsForSource = toPositiveInt(source.maxItems, maxItemsPerSource);
  const sourceDaysBack = toPositiveInt(source.daysBack, daysBack);

  let sitemapItems = [];
  if (source.enableSitemap && source.sitemapIndexUrl) {
    const sitemapIndexAllowed = await isSourceUrlAllowedByRobots(
      source.sitemapIndexUrl,
      source,
      `${source.name}/SitemapIndex`
    );

    if (sitemapIndexAllowed) {
      try {
        const indexResponse = await getWithRetry(source.sitemapIndexUrl, {
          context: `${source.name}/SitemapIndex`,
          headers: sourceHeaders,
        });
        const sitemapIndexAudit = buildFetchAudit(
          indexResponse,
          source.sitemapIndexUrl
        );

        const maxSitemaps = toPositiveInt(source.maxSitemaps, maxSitemapsPerSource);
        const sitemaps = extractSitemapsFromIndex(indexResponse.data).slice(
          0,
          maxSitemaps
        );

        const seenSitemapUrls = new Set();
        for (const sitemapUrl of sitemaps) {
          const sitemapAllowed = await isSourceUrlAllowedByRobots(
            sitemapUrl,
            source,
            `${source.name}/SitemapFile`
          );
          if (!sitemapAllowed) continue;

          const smResponse = await getWithRetry(sitemapUrl, {
            context: `${source.name}/SitemapFile`,
            headers: sourceHeaders,
          });
          const sitemapFileAudit = buildFetchAudit(smResponse, sitemapUrl);

          const urls = extractUrlsFromSitemap(smResponse.data, source);
          urls.forEach((entry) => {
            if (seenSitemapUrls.has(entry.url)) return;
            seenSitemapUrls.add(entry.url);
            sitemapItems.push({
              name: inferTitleFromUrl(entry.url),
              url: entry.url,
              lastmod: entry.lastmod,
              ingestionMeta: {
                sourceSitemapIndexAudit: sitemapIndexAudit,
                sourceFetchAudit: sitemapFileAudit,
              },
            });
          });

          if (sitemapItems.length >= maxItemsForSource) break;
        }

        sitemapItems = filterByDays(sitemapItems, sourceDaysBack);
      } catch (_error) {
        if (metrics) metrics.parseErrorCount += 1;
        logger.warn(`${sourceTag} Não foi possível acessar o sitemap.`);
      }
    }
  }

  let feedItems = [];
  if (source.feedUrl) {
    const feedAllowed = await isSourceUrlAllowedByRobots(
      source.feedUrl,
      source,
      `${source.name}/Feed`
    );

    if (feedAllowed) {
      try {
        const feedResponse = await getWithRetry(source.feedUrl, {
          context: `${source.name}/Feed`,
          headers: sourceHeaders,
        });
        const feedAudit = buildFetchAudit(feedResponse, source.feedUrl);

        feedItems = extractArticlesFromFeed(feedResponse.data, source);
        feedItems = feedItems.map((item) => ({
          ...item,
          ingestionMeta: {
            ...(item.ingestionMeta || {}),
            sourceFetchAudit: feedAudit,
          },
        }));
        feedItems = filterByDays(feedItems, sourceDaysBack);
      } catch (_error) {
        if (metrics) metrics.parseErrorCount += 1;
        logger.warn(`${sourceTag} Não foi possível acessar o feed.`);
      }
    }
  }

  sitemapItems = enrichSitemapNames(sitemapItems, feedItems);

  let homeItems = [];
  const hasPrimaryItems = sitemapItems.length || feedItems.length;
  const shouldMergeBuckets = Boolean(source.mergeBuckets);
  const shouldCollectFromHome =
    source.monitorUrl && (!hasPrimaryItems || shouldMergeBuckets);

  if (shouldCollectFromHome) {
    const homeAllowed = await isSourceUrlAllowedByRobots(
      source.monitorUrl,
      source,
      `${source.name}/Home`
    );

    if (homeAllowed) {
      try {
        const homeResponse = await getWithRetry(source.monitorUrl, {
          context: `${source.name}/Home`,
          headers: sourceHeaders,
        });
        const homeAudit = buildFetchAudit(homeResponse, source.monitorUrl);

        homeItems = extractArticlesFromHomeHtml(homeResponse.data, source);
        homeItems = homeItems.map((item) => ({
          ...item,
          ingestionMeta: {
            ...(item.ingestionMeta || {}),
            sourceFetchAudit: homeAudit,
          },
        }));
      } catch (_error) {
        if (metrics) metrics.parseErrorCount += 1;
        logger.warn(
          `${sourceTag} Não foi possível acessar a página principal da fonte.`
        );
      }
    }
  }

  const bucketItems = {
    sitemap: withBucket(sitemapItems, source, "sitemap", "sitemap"),
    feed: withBucket(feedItems, source, "feed", "rss"),
    home: withBucket(homeItems, source, "home", "home"),
  };

  if (metrics) {
    metrics.byBucket.sitemap = bucketItems.sitemap.length;
    metrics.byBucket.feed = bucketItems.feed.length;
    metrics.byBucket.home = bucketItems.home.length;
  }

  const priority = Array.isArray(source.collectionPriority)
    ? source.collectionPriority
    : ["sitemap", "feed", "home"];

  let selectedItems = [];
  let selectedBucketName = "none";

  if (source.mergeBuckets) {
    const seenUrls = new Set();
    const merged = [];
    const usedBuckets = [];

    for (const bucketName of priority) {
      const items = bucketItems[bucketName] || [];
      if (!items.length) continue;

      usedBuckets.push(bucketName);
      items.forEach((item) => {
        if (!item.url || seenUrls.has(item.url)) return;
        seenUrls.add(item.url);
        merged.push(item);
      });
    }

    selectedItems = merged;
    selectedBucketName = usedBuckets.length ? usedBuckets.join("+") : "none";
  } else {
    for (const bucketName of priority) {
      const items = bucketItems[bucketName] || [];
      if (!items.length) continue;
      selectedItems = items;
      selectedBucketName = bucketName;
      break;
    }
  }

  if (!selectedItems.length) {
    logger.warn(`${sourceTag} Nenhum item coletado nesta fonte.`);
    return [];
  }

  selectedItems = await annotateItemsWithRobots(
    selectedItems,
    source,
    `${source.name}/Candidates`
  );

  if (!selectedItems.length) {
    logger.warn(
      `${sourceTag} Nenhum item elegível após aplicar regras de robots.txt.`
    );
    return [];
  }

  if (selectedItems.length > maxItemsForSource) {
    selectedItems = selectedItems.slice(0, maxItemsForSource);
  }

  if (metrics) {
    metrics.fetchedCount += selectedItems.length;
    metrics.fetchRestrictedCount += selectedItems.filter(
      (item) => item.fetchRestricted
    ).length;
  }

  logger.info(
    `${sourceTag} ${selectedItems.length} item(ns) coletados via ${selectedBucketName}.`
  );

  return selectedItems;
}

module.exports = {
  collectItemsFromSource,
};
