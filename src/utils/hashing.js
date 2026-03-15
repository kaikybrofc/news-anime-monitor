const crypto = require("crypto");

function sha1(value) {
  return crypto.createHash("sha1").update(String(value || "")).digest("hex");
}

function sha256(value) {
  return crypto
    .createHash("sha256")
    .update(String(value || ""))
    .digest("hex");
}

function normalizeHashText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function roundPublishedDate(publishedAt) {
  if (!publishedAt) return "";

  const parsed = Date.parse(publishedAt);
  if (Number.isNaN(parsed)) return "";

  return new Date(parsed).toISOString().slice(0, 10);
}

function buildIdentityHash({ domain, titleNormalized, publishedAt }) {
  const payload = [
    normalizeHashText(domain),
    normalizeHashText(titleNormalized),
    roundPublishedDate(publishedAt),
  ].join("|");

  return sha256(payload);
}

function buildContentHash({
  domain,
  titleNormalized,
  summaryNormalized,
  publishedAt,
}) {
  const payload = [
    normalizeHashText(domain),
    normalizeHashText(titleNormalized),
    normalizeHashText(summaryNormalized).slice(0, 200),
    roundPublishedDate(publishedAt),
  ].join("|");

  return sha256(payload);
}

module.exports = {
  sha1,
  sha256,
  roundPublishedDate,
  buildIdentityHash,
  buildContentHash,
};
