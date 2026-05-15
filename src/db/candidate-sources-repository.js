const { hasDbConfig, getPool, pingDatabase } = require("./mysql.js");

const CANDIDATE_TABLE = "candidate_sources";
const VALIDATED_TABLE = "validated_candidates";
const KEYWORD_DISCOVERY_TABLE = "keyword_discovery_jobs";

function quoteIdentifier(name) {
  return `\`${String(name || "").replace(/`/g, "``")}\``;
}

function toSqlDate(value) {
  const parsed = Date.parse(String(value || ""));
  if (Number.isNaN(parsed)) return null;
  return new Date(parsed).toISOString().slice(0, 23).replace("T", " ");
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toBoolInt(value) {
  return value ? 1 : 0;
}

async function ensureCandidateValidationTables() {
  if (!hasDbConfig()) {
    throw new Error("Configuração de MySQL ausente.");
  }

  const db = getPool();
  await pingDatabase();

  await db.query(`
    CREATE TABLE IF NOT EXISTS ${quoteIdentifier(CANDIDATE_TABLE)} (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      domain VARCHAR(255) NOT NULL,
      topic_confidence DECIMAL(6,4) NOT NULL DEFAULT 0,
      reference_count INT NOT NULL DEFAULT 0,
      unique_articles INT NOT NULL DEFAULT 0,
      first_seen_at DATETIME(3) NULL,
      last_seen_at DATETIME(3) NULL,
      sample_urls_json JSON NOT NULL,
      discovered_at DATETIME(3) NOT NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      UNIQUE KEY uniq_domain (domain),
      KEY idx_last_seen (last_seen_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS ${quoteIdentifier(KEYWORD_DISCOVERY_TABLE)} (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      query_text VARCHAR(255) NOT NULL,
      language VARCHAR(16) NOT NULL DEFAULT 'en',
      search_engine VARCHAR(32) NOT NULL DEFAULT 'brave',
      domains_found INT NOT NULL DEFAULT 0,
      new_candidates INT NOT NULL DEFAULT 0,
      results_json JSON NOT NULL,
      ran_at DATETIME(3) NOT NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      KEY idx_query_ran_at (query_text, ran_at),
      KEY idx_ran_at (ran_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS ${quoteIdentifier(VALIDATED_TABLE)} (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      domain VARCHAR(255) NOT NULL,
      rss_detected TINYINT(1) NOT NULL DEFAULT 0,
      rss_url VARCHAR(1024) NOT NULL DEFAULT '',
      sitemap_detected TINYINT(1) NOT NULL DEFAULT 0,
      sitemap_url VARCHAR(1024) NOT NULL DEFAULT '',
      activity_score INT NOT NULL DEFAULT 0,
      topic_confidence DECIMAL(6,4) NOT NULL DEFAULT 0,
      quality_estimate INT NOT NULL DEFAULT 0,
      spam_probability DECIMAL(6,4) NOT NULL DEFAULT 0,
      source_type VARCHAR(32) NOT NULL DEFAULT 'unknown',
      validation_score INT NOT NULL DEFAULT 0,
      status VARCHAR(32) NOT NULL DEFAULT 'rejected',
      sandbox_status VARCHAR(32) NOT NULL DEFAULT 'not_started',
      sandbox_days SMALLINT NOT NULL DEFAULT 0,
      inspected_urls_json JSON NOT NULL,
      topic_breakdown_json JSON NOT NULL,
      signals_json JSON NOT NULL,
      validated_at DATETIME(3) NOT NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      UNIQUE KEY uniq_domain (domain),
      KEY idx_status_score (status, validation_score),
      KEY idx_validated_at (validated_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

async function saveDiscoveredCandidates(candidates = [], discoveredAt = new Date().toISOString()) {
  if (!Array.isArray(candidates) || !candidates.length) return;
  const db = getPool();

  const rows = candidates.map((item) => [
    String(item.domain || ""),
    toNumber(item.topicConfidence, 0),
    Math.max(0, Math.floor(toNumber(item.referenceCount, 0))),
    Math.max(0, Math.floor(toNumber(item.uniqueArticles, 0))),
    toSqlDate(item.firstSeenAt),
    toSqlDate(item.lastSeenAt),
    JSON.stringify(Array.isArray(item.sampleUrls) ? item.sampleUrls : []),
    toSqlDate(discoveredAt),
  ]).filter((row) => row[0]);

  if (!rows.length) return;

  await db.query(
    `INSERT INTO ${quoteIdentifier(CANDIDATE_TABLE)} (
      domain, topic_confidence, reference_count, unique_articles,
      first_seen_at, last_seen_at, sample_urls_json, discovered_at
    ) VALUES ?
    ON DUPLICATE KEY UPDATE
      topic_confidence = VALUES(topic_confidence),
      reference_count = VALUES(reference_count),
      unique_articles = VALUES(unique_articles),
      first_seen_at = VALUES(first_seen_at),
      last_seen_at = VALUES(last_seen_at),
      sample_urls_json = VALUES(sample_urls_json),
      discovered_at = VALUES(discovered_at)`,
    [rows]
  );
}

async function saveKeywordDiscoveryJobs(jobs = [], ranAt = new Date().toISOString()) {
  if (!Array.isArray(jobs) || !jobs.length) return;
  const db = getPool();

  const rows = jobs
    .map((job) => [
      String(job.query || ""),
      String(job.language || "en"),
      String(job.searchEngine || "brave"),
      Math.max(0, Math.floor(toNumber(job.domainsFound, 0))),
      Math.max(0, Math.floor(toNumber(job.newCandidates, 0))),
      JSON.stringify(Array.isArray(job.results) ? job.results : []),
      toSqlDate(job.lastRunAt || ranAt),
    ])
    .filter((row) => row[0]);

  if (!rows.length) return;

  await db.query(
    `INSERT INTO ${quoteIdentifier(KEYWORD_DISCOVERY_TABLE)} (
      query_text, language, search_engine, domains_found, new_candidates, results_json, ran_at
    ) VALUES ?`,
    [rows]
  );
}

async function saveValidatedCandidates(items = [], validatedAt = new Date().toISOString()) {
  if (!Array.isArray(items) || !items.length) return;
  const db = getPool();

  const rows = items.map((item) => [
    String(item.domain || ""),
    toBoolInt(item.rssDetected),
    String(item.rssUrl || ""),
    toBoolInt(item.sitemapDetected),
    String(item.sitemapUrl || ""),
    Math.max(0, Math.floor(toNumber(item.activityScore, 0))),
    toNumber(item.topicConfidence, 0),
    Math.max(0, Math.floor(toNumber(item.qualityEstimate, 0))),
    Math.max(0, Math.min(1, toNumber(item.spamProbability, 0))),
    String(item.sourceType || "unknown"),
    Math.max(0, Math.floor(toNumber(item.validationScore, 0))),
    String(item.status || "rejected"),
    String(item.sandboxStatus || "not_started"),
    Math.max(0, Math.floor(toNumber(item.sandboxDays, 0))),
    JSON.stringify(Array.isArray(item.inspectedUrls) ? item.inspectedUrls : []),
    JSON.stringify(item.topicBreakdown || {}),
    JSON.stringify(item.signals || {}),
    toSqlDate(validatedAt),
  ]).filter((row) => row[0]);

  if (!rows.length) return;

  await db.query(
    `INSERT INTO ${quoteIdentifier(VALIDATED_TABLE)} (
      domain, rss_detected, rss_url, sitemap_detected, sitemap_url,
      activity_score, topic_confidence, quality_estimate, spam_probability,
      source_type, validation_score, status, sandbox_status, sandbox_days,
      inspected_urls_json, topic_breakdown_json, signals_json, validated_at
    ) VALUES ?
    ON DUPLICATE KEY UPDATE
      rss_detected = VALUES(rss_detected),
      rss_url = VALUES(rss_url),
      sitemap_detected = VALUES(sitemap_detected),
      sitemap_url = VALUES(sitemap_url),
      activity_score = VALUES(activity_score),
      topic_confidence = VALUES(topic_confidence),
      quality_estimate = VALUES(quality_estimate),
      spam_probability = VALUES(spam_probability),
      source_type = VALUES(source_type),
      validation_score = VALUES(validation_score),
      status = VALUES(status),
      sandbox_status = VALUES(sandbox_status),
      sandbox_days = VALUES(sandbox_days),
      inspected_urls_json = VALUES(inspected_urls_json),
      topic_breakdown_json = VALUES(topic_breakdown_json),
      signals_json = VALUES(signals_json),
      validated_at = VALUES(validated_at)`,
    [rows]
  );
}

module.exports = {
  ensureCandidateValidationTables,
  saveDiscoveredCandidates,
  saveValidatedCandidates,
  saveKeywordDiscoveryJobs,
};
