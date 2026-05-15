const { hasDbConfig, getPool, pingDatabase } = require("./mysql.js");

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
    payloadJson: JSON.stringify(item || {}),
  };
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
      payload_json JSON NOT NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      KEY idx_run_id (run_id),
      KEY idx_source_extracted_at (source_id, extracted_at),
      KEY idx_extracted_at (extracted_at),
      KEY idx_bucket (bucket),
      KEY idx_url (url(255))
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
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
