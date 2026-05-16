const { hasDbConfig, getPool, pingDatabase } = require("./mysql.js");
const crypto = require("crypto");

const TABLE_NAME = "extractor_items";

function quoteIdentifier(name) {
  return `\`${String(name || "").replace(/`/g, "``")}\``;
}

function toSqlDate(value) {
  const parsed = Date.parse(String(value || ""));
  if (Number.isNaN(parsed)) {
    return null;
  }

  return new Date(parsed).toISOString().slice(0, 23).replace("T", " ");
}

function normalizeBooleanFlag(value) {
  return value ? 1 : 0;
}

function toInt(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.floor(parsed) : fallback;
}

function firstNonEmptyString(...values) {
  for (const value of values) {
    const text = String(value || "").trim();
    if (text) return text;
  }
  return "";
}

function hashText(value) {
  const text = String(value || "");
  if (!text) return "";
  return crypto.createHash("sha256").update(text).digest("hex");
}

function buildAuditPayload(item = {}, options = {}) {
  const ingestionMeta = item.ingestionMeta || {};
  const sourceFetchAudit = ingestionMeta.sourceFetchAudit || {};
  const sourceSitemapIndexAudit = ingestionMeta.sourceSitemapIndexAudit || {};

  return {
    runId: String(options.runId || "").trim(),
    extractedAt:
      String(options.extractedAt || "").trim() || new Date().toISOString(),
    source: {
      id: String(
        options.sourceId || item.sourceId || ingestionMeta.source || ""
      ).trim(),
      name: String(options.sourceName || item.sourceName || "").trim(),
      bucket:
        String(item.bucket || ingestionMeta.bucket || "unknown").trim() ||
        "unknown",
      collectedFrom:
        String(item.collectedFrom || ingestionMeta.collectedFrom || "").trim() ||
        "unknown",
    },
    urls: {
      discoveredUrl: String(item.url || "").trim(),
      canonicalUrl: String(item.canonicalUrl || item.url || "").trim(),
      finalUrl: String(sourceFetchAudit.finalUrl || "").trim(),
    },
    timing: {
      discoveredAt:
        String(options.extractedAt || "").trim() || new Date().toISOString(),
      lastmod: String(item.lastmod || "").trim(),
    },
    robots: {
      allowedForFetch: Boolean(ingestionMeta.robotsAllowedForFetch),
      reason: String(ingestionMeta.robotsReason || "").trim(),
      rule: String(ingestionMeta.robotsRule || "").trim(),
      fetchRestricted: Boolean(item.fetchRestricted),
    },
    sourceRequest: {
      requestedUrl: String(sourceFetchAudit.requestedUrl || "").trim(),
      finalUrl: String(sourceFetchAudit.finalUrl || "").trim(),
      statusCode: toInt(sourceFetchAudit.statusCode, 0),
      contentType: String(sourceFetchAudit.contentType || "").trim(),
      contentLength: toInt(sourceFetchAudit.contentLength, 0),
      etag: String(sourceFetchAudit.etag || "").trim(),
      lastModified: String(sourceFetchAudit.lastModified || "").trim(),
      cacheControl: String(sourceFetchAudit.cacheControl || "").trim(),
      responseHash: String(sourceFetchAudit.responseHash || "").trim(),
    },
    sitemapIndexRequest: {
      requestedUrl: String(sourceSitemapIndexAudit.requestedUrl || "").trim(),
      finalUrl: String(sourceSitemapIndexAudit.finalUrl || "").trim(),
      statusCode: toInt(sourceSitemapIndexAudit.statusCode, 0),
      contentType: String(sourceSitemapIndexAudit.contentType || "").trim(),
      contentLength: toInt(sourceSitemapIndexAudit.contentLength, 0),
      etag: String(sourceSitemapIndexAudit.etag || "").trim(),
      lastModified: String(sourceSitemapIndexAudit.lastModified || "").trim(),
      cacheControl: String(sourceSitemapIndexAudit.cacheControl || "").trim(),
      responseHash: String(sourceSitemapIndexAudit.responseHash || "").trim(),
    },
    extraction: {
      title: String(item.name || "").trim(),
      titleHash: hashText(item.name || ""),
      extractorVersion: "2026-05-audit-v1",
    },
    payloadHash: hashText(JSON.stringify(item || {})),
  };
}

function serializeExtractedItem(item = {}, options = {}) {
  const runId = String(options.runId || "").trim();
  const sourceId = String(
    options.sourceId || item.sourceId || item.ingestionMeta?.source || ""
  ).trim();
  const sourceName = String(options.sourceName || item.sourceName || "").trim();
  const extractedAt =
    String(options.extractedAt || "").trim() || new Date().toISOString();

  const url = String(item.url || item.canonicalUrl || "").trim();
  if (!url) return null;

  return {
    runId,
    extractedAt,
    sourceId,
    sourceName,
    bucket: String(item.bucket || item.ingestionMeta?.bucket || "unknown").trim() || "unknown",
    collectedFrom:
      String(item.collectedFrom || item.ingestionMeta?.collectedFrom || "").trim() ||
      "unknown",
    title: String(item.name || "").trim(),
    url,
    lastmod: String(item.lastmod || "").trim(),
    fetchRestricted: normalizeBooleanFlag(item.fetchRestricted),
    robotsReason: String(item.ingestionMeta?.robotsReason || "").trim(),
    robotsRule: String(item.ingestionMeta?.robotsRule || "").trim(),
    robotsAllowedForFetch: normalizeBooleanFlag(
      item.ingestionMeta?.robotsAllowedForFetch
    ),
    requestStatusCode: toInt(item.ingestionMeta?.sourceFetchAudit?.statusCode, 0),
    requestFinalUrl: firstNonEmptyString(
      item.ingestionMeta?.sourceFetchAudit?.finalUrl,
      item.url
    ),
    responseContentType: String(
      item.ingestionMeta?.sourceFetchAudit?.contentType || ""
    ).trim(),
    responseContentLength: toInt(
      item.ingestionMeta?.sourceFetchAudit?.contentLength,
      0
    ),
    responseHash: String(item.ingestionMeta?.sourceFetchAudit?.responseHash || "").trim(),
    extractorVersion: "2026-05-audit-v1",
    auditJson: JSON.stringify(buildAuditPayload(item, options)),
    payloadJson: JSON.stringify(item || {}),
  };
}

async function ensureColumnExists(db, columnName, sqlTypeClause) {
  const [rows] = await db.query(
    `
      SELECT 1
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND COLUMN_NAME = ?
      LIMIT 1
    `,
    [TABLE_NAME, columnName]
  );

  if (rows.length) return;

  await db.query(
    `ALTER TABLE ${quoteIdentifier(TABLE_NAME)} ADD COLUMN ${quoteIdentifier(
      columnName
    )} ${sqlTypeClause}`
  );
}

async function ensureExtractorItemsTable() {
  if (!hasDbConfig()) {
    throw new Error(
      "Configuração de MySQL ausente. Defina DB_HOST, DB_USER, DB_PASSWORD, DB_NAME."
    );
  }

  const db = getPool();
  await pingDatabase();

  await db.query(`
    CREATE TABLE IF NOT EXISTS ${quoteIdentifier(TABLE_NAME)} (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      run_id VARCHAR(64) NOT NULL,
      extracted_at DATETIME(3) NOT NULL,
      source_id VARCHAR(64) NOT NULL DEFAULT '',
      source_name VARCHAR(128) NOT NULL DEFAULT '',
      bucket VARCHAR(32) NOT NULL DEFAULT 'unknown',
      collected_from VARCHAR(32) NOT NULL DEFAULT 'unknown',
      title VARCHAR(512) NOT NULL DEFAULT '',
      url VARCHAR(1024) NOT NULL,
      lastmod VARCHAR(64) NOT NULL DEFAULT '',
      fetch_restricted TINYINT(1) NOT NULL DEFAULT 0,
      robots_reason VARCHAR(64) NOT NULL DEFAULT '',
      robots_rule VARCHAR(255) NOT NULL DEFAULT '',
      robots_allowed_for_fetch TINYINT(1) NOT NULL DEFAULT 0,
      request_status_code INT NOT NULL DEFAULT 0,
      request_final_url VARCHAR(1024) NOT NULL DEFAULT '',
      response_content_type VARCHAR(128) NOT NULL DEFAULT '',
      response_content_length BIGINT NOT NULL DEFAULT 0,
      response_hash CHAR(64) NOT NULL DEFAULT '',
      extractor_version VARCHAR(32) NOT NULL DEFAULT '',
      audit_json JSON NULL,
      payload_json JSON NOT NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      KEY idx_run_id (run_id),
      KEY idx_source_extracted_at (source_id, extracted_at),
      KEY idx_extracted_at (extracted_at),
      KEY idx_bucket (bucket),
      KEY idx_url (url(255)),
      KEY idx_request_status_code (request_status_code)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await ensureColumnExists(db, "robots_reason", "VARCHAR(64) NOT NULL DEFAULT ''");
  await ensureColumnExists(db, "robots_rule", "VARCHAR(255) NOT NULL DEFAULT ''");
  await ensureColumnExists(
    db,
    "robots_allowed_for_fetch",
    "TINYINT(1) NOT NULL DEFAULT 0"
  );
  await ensureColumnExists(db, "request_status_code", "INT NOT NULL DEFAULT 0");
  await ensureColumnExists(
    db,
    "request_final_url",
    "VARCHAR(1024) NOT NULL DEFAULT ''"
  );
  await ensureColumnExists(
    db,
    "response_content_type",
    "VARCHAR(128) NOT NULL DEFAULT ''"
  );
  await ensureColumnExists(
    db,
    "response_content_length",
    "BIGINT NOT NULL DEFAULT 0"
  );
  await ensureColumnExists(db, "response_hash", "CHAR(64) NOT NULL DEFAULT ''");
  await ensureColumnExists(
    db,
    "extractor_version",
    "VARCHAR(32) NOT NULL DEFAULT ''"
  );
  await ensureColumnExists(db, "audit_json", "JSON NULL");
}

async function saveExtractedItemsSnapshot(items = [], options = {}) {
  if (!Array.isArray(items) || !items.length) return;

  const db = getPool();
  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();

    const rows = items
      .map((item) => serializeExtractedItem(item, options))
      .filter(Boolean)
      .map((item) => [
        item.runId,
        toSqlDate(item.extractedAt),
        item.sourceId,
        item.sourceName,
        item.bucket,
        item.collectedFrom,
        item.title,
        item.url,
        item.lastmod,
        item.fetchRestricted,
        item.robotsReason,
        item.robotsRule,
        item.robotsAllowedForFetch,
        item.requestStatusCode,
        item.requestFinalUrl,
        item.responseContentType,
        item.responseContentLength,
        item.responseHash,
        item.extractorVersion,
        item.auditJson,
        item.payloadJson,
      ]);

    if (rows.length) {
      const insertSql = `
        INSERT INTO ${quoteIdentifier(TABLE_NAME)} (
          run_id,
          extracted_at,
          source_id,
          source_name,
          bucket,
          collected_from,
          title,
          url,
          lastmod,
          fetch_restricted,
          robots_reason,
          robots_rule,
          robots_allowed_for_fetch,
          request_status_code,
          request_final_url,
          response_content_type,
          response_content_length,
          response_hash,
          extractor_version,
          audit_json,
          payload_json
        ) VALUES ?
      `;

      await conn.query(insertSql, [rows]);
    }

    await conn.commit();
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return parsed;
}

async function queryExtractorSummary(params = {}) {
  await pingDatabase();
  const db = getPool();

  const windowHours = Math.max(1, Math.floor(toNumber(params.windowHours, 24)));
  const topSources = Math.max(1, Math.floor(toNumber(params.topSources, 12)));
  const topRuns = Math.max(1, Math.floor(toNumber(params.topRuns, 8)));

  const [totalsRows] = await db.query(
    `
      SELECT
        COUNT(*) AS totalItems,
        COUNT(DISTINCT run_id) AS totalRuns,
        COUNT(DISTINCT source_id) AS totalSources,
        SUM(CASE WHEN fetch_restricted = 1 THEN 1 ELSE 0 END) AS fetchRestrictedCount,
        DATE_FORMAT(MAX(extracted_at), '%Y-%m-%dT%H:%i:%s.%fZ') AS latestExtractedAt
      FROM ${quoteIdentifier(TABLE_NAME)}
      WHERE extracted_at >= DATE_SUB(UTC_TIMESTAMP(3), INTERVAL ? HOUR)
    `,
    [windowHours]
  );

  const [bucketRows] = await db.query(
    `
      SELECT bucket, COUNT(*) AS count
      FROM ${quoteIdentifier(TABLE_NAME)}
      WHERE extracted_at >= DATE_SUB(UTC_TIMESTAMP(3), INTERVAL ? HOUR)
      GROUP BY bucket
      ORDER BY count DESC
    `,
    [windowHours]
  );

  const [sourceRows] = await db.query(
    `
      SELECT
        source_id AS sourceId,
        COALESCE(NULLIF(source_name, ''), source_id) AS sourceName,
        COUNT(*) AS count,
        SUM(CASE WHEN fetch_restricted = 1 THEN 1 ELSE 0 END) AS fetchRestrictedCount,
        DATE_FORMAT(MAX(extracted_at), '%Y-%m-%dT%H:%i:%s.%fZ') AS latestExtractedAt
      FROM ${quoteIdentifier(TABLE_NAME)}
      WHERE extracted_at >= DATE_SUB(UTC_TIMESTAMP(3), INTERVAL ? HOUR)
      GROUP BY source_id, sourceName
      ORDER BY count DESC
      LIMIT ?
    `,
    [windowHours, topSources]
  );

  const [runRows] = await db.query(
    `
      SELECT
        run_id AS runId,
        COUNT(*) AS count,
        COUNT(DISTINCT source_id) AS sourceCount,
        SUM(CASE WHEN fetch_restricted = 1 THEN 1 ELSE 0 END) AS fetchRestrictedCount,
        DATE_FORMAT(MAX(extracted_at), '%Y-%m-%dT%H:%i:%s.%fZ') AS extractedAt
      FROM ${quoteIdentifier(TABLE_NAME)}
      WHERE extracted_at >= DATE_SUB(UTC_TIMESTAMP(3), INTERVAL ? HOUR)
      GROUP BY run_id
      ORDER BY MAX(extracted_at) DESC
      LIMIT ?
    `,
    [windowHours, topRuns]
  );

  const totals = totalsRows?.[0] || {};

  return {
    windowHours,
    totals: {
      totalItems: toNumber(totals.totalItems, 0),
      totalRuns: toNumber(totals.totalRuns, 0),
      totalSources: toNumber(totals.totalSources, 0),
      fetchRestrictedCount: toNumber(totals.fetchRestrictedCount, 0),
      latestExtractedAt: String(totals.latestExtractedAt || ""),
    },
    byBucket: bucketRows.map((row) => ({
      bucket: String(row.bucket || "unknown"),
      count: toNumber(row.count, 0),
    })),
    bySource: sourceRows.map((row) => ({
      sourceId: String(row.sourceId || ""),
      sourceName: String(row.sourceName || row.sourceId || ""),
      count: toNumber(row.count, 0),
      fetchRestrictedCount: toNumber(row.fetchRestrictedCount, 0),
      latestExtractedAt: String(row.latestExtractedAt || ""),
    })),
    recentRuns: runRows.map((row) => ({
      runId: String(row.runId || ""),
      count: toNumber(row.count, 0),
      sourceCount: toNumber(row.sourceCount, 0),
      fetchRestrictedCount: toNumber(row.fetchRestrictedCount, 0),
      extractedAt: String(row.extractedAt || ""),
    })),
  };
}

module.exports = {
  ensureExtractorItemsTable,
  saveExtractedItemsSnapshot,
  queryExtractorSummary,
};
