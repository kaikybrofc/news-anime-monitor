const {
  matchesDomain,
  matchesAllowedPrefixes,
  matchesExcludedPrefixes,
} = require("../utils/url-normalization.js");
const {
  categoriesMatchRequired,
} = require("../utils/category-normalization.js");

function validateItemAgainstSource(item, source) {
  if (!item?.canonicalUrl) {
    return { accepted: false, reason: "invalid_url" };
  }

  if (!matchesDomain(item.domain, source.domains || [])) {
    return { accepted: false, reason: "domain_mismatch" };
  }

  if (!item.pathname || item.pathname === "/") {
    return { accepted: false, reason: "invalid_path" };
  }

  if (matchesExcludedPrefixes(item.pathname, source.excludedPathPrefixes || [])) {
    return { accepted: false, reason: "excluded_path_prefix" };
  }

  if (
    !matchesAllowedPrefixes(item.pathname, source.allowedPathPrefixes || [])
  ) {
    return { accepted: false, reason: "not_allowed_path_prefix" };
  }

  if (
    item.bucket === "feed" &&
    !categoriesMatchRequired(
      item.categories,
      source.requiredFeedCategories || []
    )
  ) {
    return { accepted: false, reason: "required_feed_category_missing" };
  }

  const enforceScopeBeyondFeed =
    Boolean(source.enforceCategoryScopeAcrossBuckets) &&
    Array.isArray(source.requiredFeedCategories) &&
    source.requiredFeedCategories.length > 0;

  if (
    enforceScopeBeyondFeed &&
    item.bucket !== "feed" &&
    Array.isArray(item.categories) &&
    item.categories.length > 0 &&
    !categoriesMatchRequired(item.categories, source.requiredFeedCategories || [])
  ) {
    return { accepted: false, reason: "required_scope_category_missing" };
  }

  return { accepted: true, reason: "accepted" };
}

function filterItemsBySource(items, source, metrics) {
  const accepted = [];
  const rejected = [];

  for (const item of items) {
    const validation = validateItemAgainstSource(item, source);

    if (!validation.accepted) {
      rejected.push({ ...item, rejectedReason: validation.reason });
      if (metrics) metrics.rejectedCount += 1;
      continue;
    }

    if (!item.categoriesNormalized || !item.categoriesNormalized.length) {
      if (metrics) metrics.emptyCategoryCount += 1;
    }

    if (metrics) {
      const bucketKey = String(item.bucket || "unknown");
      if (metrics.acceptedByBucket[bucketKey] === undefined) {
        metrics.acceptedByBucket[bucketKey] = 0;
      }
      metrics.acceptedByBucket[bucketKey] += 1;

      const contentTypeKey = String(item.contentType || "unknown");
      if (metrics.contentTypes[contentTypeKey] === undefined) {
        metrics.contentTypes[contentTypeKey] = 0;
      }
      metrics.contentTypes[contentTypeKey] += 1;
    }

    accepted.push(item);
  }

  if (metrics) {
    metrics.acceptedCount += accepted.length;
  }

  return { accepted, rejected };
}

module.exports = {
  validateItemAgainstSource,
  filterItemsBySource,
};
