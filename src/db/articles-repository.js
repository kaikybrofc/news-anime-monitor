const {
  hasDbConfig,
  getPool,
  pingDatabase,
} = require("./mysql.js");

const TABLE_NAME = "articles";

function quoteIdentifier(name) {
  return `\`${String(name || "").replace(/`/g, "``")}\``;
}

function serializeArticle(article) {
  const refined = article?.refined || {};

  return {
    id: String(article?.id || ""),
    timestamp: String(article?.timestamp || new Date().toISOString()),
    canonicalUrl: String(refined?.canonicalUrl || refined?.url || ""),
    sourceId: String(refined?.sourceId || ""),
    sourceName: String(refined?.sourceName || ""),
    bucket: String(refined?.bucket || "unknown"),
    sourceType: String(refined?.sourceType || "unknown"),
    contentType: String(refined?.contentType || "unknown"),
    score: Number.isFinite(refined?.score) ? Math.floor(refined.score) : 0,
    firstSeenAt: String(refined?.firstSeenAt || ""),
    lastSeenAt: String(refined?.lastSeenAt || ""),
    timesSeen: Number.isFinite(refined?.timesSeen)
      ? Math.max(1, Math.floor(refined.timesSeen))
      : 1,
    refinedJson: JSON.stringify(refined || {}),
  };
}

function parseArticleRow(row) {
  let refined = {};

  try {
    refined = JSON.parse(row.refined_json || "{}");
  } catch {
    refined = {};
  }

  return {
    id: row.id,
    timestamp: row.timestamp,
    refined,
  };
}

function toSqlDate(value) {
  const parsed = Date.parse(String(value || ""));
  if (Number.isNaN(parsed)) {
    return null;
  }

  return new Date(parsed).toISOString().slice(0, 23).replace("T", " ");
}

async function ensureDatabaseAndTable() {
  if (!hasDbConfig()) {
    throw new Error(
      "Configuração de MySQL ausente. Defina DB_HOST, DB_USER, DB_PASSWORD, DB_NAME."
    );
  }

  const db = getPool();
  await pingDatabase();
  await db.query(`
    CREATE TABLE IF NOT EXISTS ${quoteIdentifier(TABLE_NAME)} (
      id CHAR(40) PRIMARY KEY,
      timestamp DATETIME(3) NOT NULL,
      canonical_url VARCHAR(1024) NOT NULL,
      source_id VARCHAR(64) NOT NULL DEFAULT '',
      source_name VARCHAR(128) NOT NULL DEFAULT '',
      bucket VARCHAR(32) NOT NULL DEFAULT 'unknown',
      source_type VARCHAR(32) NOT NULL DEFAULT 'unknown',
      content_type VARCHAR(32) NOT NULL DEFAULT 'unknown',
      score INT NOT NULL DEFAULT 0,
      first_seen_at DATETIME(3) NULL,
      last_seen_at DATETIME(3) NULL,
      times_seen INT NOT NULL DEFAULT 1,
      refined_json JSON NOT NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      KEY idx_canonical_url (canonical_url(255)),
      KEY idx_source_last_seen (source_id, last_seen_at),
      KEY idx_last_seen (last_seen_at),
      KEY idx_score (score)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

async function loadAllArticles() {
  await pingDatabase();
  const db = getPool();

  const [rows] = await db.query(
    `SELECT id, DATE_FORMAT(timestamp, '%Y-%m-%dT%H:%i:%s.%fZ') AS timestamp, refined_json
     FROM ${quoteIdentifier(TABLE_NAME)}
     ORDER BY timestamp DESC`
  );

  return rows.map(parseArticleRow);
}

async function saveAllArticlesSnapshot(articles = []) {
  const db = getPool();
  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();

    const serializedArticles = articles
      .map(serializeArticle)
      .filter((article) => article.id && article.canonicalUrl);

    if (serializedArticles.length) {
      const insertSql = `
        INSERT INTO ${quoteIdentifier(TABLE_NAME)} (
          id,
          timestamp,
          canonical_url,
          source_id,
          source_name,
          bucket,
          source_type,
          content_type,
          score,
          first_seen_at,
          last_seen_at,
          times_seen,
          refined_json
        ) VALUES ?
        ON DUPLICATE KEY UPDATE
          timestamp = VALUES(timestamp),
          canonical_url = VALUES(canonical_url),
          source_id = VALUES(source_id),
          source_name = VALUES(source_name),
          bucket = VALUES(bucket),
          source_type = VALUES(source_type),
          content_type = VALUES(content_type),
          score = VALUES(score),
          first_seen_at = VALUES(first_seen_at),
          last_seen_at = VALUES(last_seen_at),
          times_seen = VALUES(times_seen),
          refined_json = VALUES(refined_json)
      `;

      const rows = serializedArticles.map((article) => [
        article.id,
        toSqlDate(article.timestamp),
        article.canonicalUrl,
        article.sourceId,
        article.sourceName,
        article.bucket,
        article.sourceType,
        article.contentType,
        article.score,
        toSqlDate(article.firstSeenAt),
        toSqlDate(article.lastSeenAt),
        article.timesSeen,
        article.refinedJson,
      ]);

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

module.exports = {
  ensureDatabaseAndTable,
  loadAllArticles,
  saveAllArticlesSnapshot,
};
