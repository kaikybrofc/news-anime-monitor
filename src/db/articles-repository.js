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

function toIsoDate(value) {
  const parsed = Date.parse(String(value || ""));
  if (Number.isNaN(parsed)) return "";
  return new Date(parsed).toISOString();
}

function toSqlDate(value) {
  const parsed = Date.parse(String(value || ""));
  if (Number.isNaN(parsed)) {
    return null;
  }

  return new Date(parsed).toISOString().slice(0, 23).replace("T", " ");
}

function normalizeLimit(value, fallback = 50) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
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

async function loadArticleById(articleId) {
  const id = String(articleId || "").trim();
  if (!id) return null;

  return loadSingleArticleByWhere("id = ?", [id]);
}

async function loadSingleArticleByWhere(whereSql, params = []) {
  await pingDatabase();
  const db = getPool();

  const [rows] = await db.query(
    `SELECT id, DATE_FORMAT(timestamp, '%Y-%m-%dT%H:%i:%s.%fZ') AS timestamp, refined_json
     FROM ${quoteIdentifier(TABLE_NAME)}
     WHERE ${whereSql}
     ORDER BY updated_at DESC
     LIMIT 1`,
    params
  );

  if (!rows.length) return null;
  return parseArticleRow(rows[0]);
}

async function findMatchingArticle(candidate = {}, options = {}) {
  const {
    allowTitleFallback = true,
    allowContentHash = true,
  } = options;

  const canonicalUrl = String(candidate?.canonicalUrl || candidate?.url || "");
  const sourceId = String(candidate?.sourceId || "");
  const contentHash = String(candidate?.contentHash || "");
  const identityHash = String(candidate?.identityHash || "");
  const titleNormalized = String(candidate?.titleNormalized || "");

  if (canonicalUrl) {
    const byCanonical = await loadSingleArticleByWhere("canonical_url = ?", [
      canonicalUrl,
    ]);
    if (byCanonical) {
      return { article: byCanonical, reason: "canonicalUrl", stage: "storage" };
    }
  }

  if (allowContentHash && sourceId && contentHash) {
    const byContentHash = await loadSingleArticleByWhere(
      "source_id = ? AND JSON_UNQUOTE(JSON_EXTRACT(refined_json, '$.contentHash')) = ?",
      [sourceId, contentHash]
    );
    if (byContentHash) {
      return { article: byContentHash, reason: "contentHash", stage: "storage" };
    }
  }

  if (sourceId && identityHash) {
    const byIdentityHash = await loadSingleArticleByWhere(
      "source_id = ? AND JSON_UNQUOTE(JSON_EXTRACT(refined_json, '$.identityHash')) = ?",
      [sourceId, identityHash]
    );
    if (byIdentityHash) {
      return { article: byIdentityHash, reason: "identityHash", stage: "storage" };
    }
  }

  if (allowTitleFallback && sourceId && titleNormalized) {
    const byTitle = await loadSingleArticleByWhere(
      "source_id = ? AND JSON_UNQUOTE(JSON_EXTRACT(refined_json, '$.titleNormalized')) = ?",
      [sourceId, titleNormalized]
    );
    if (byTitle) {
      return { article: byTitle, reason: "titleNormalized", stage: "storage" };
    }
  }

  return null;
}

async function queryArticles(params = {}) {
  await pingDatabase();
  const db = getPool();

  const limit = normalizeLimit(params.limit, 50);
  const offset = Math.max(0, normalizeLimit(params.offset, 0));
  const q = String(params.q || "").trim().toLowerCase();
  const sourceId = String(params.sourceId || "").trim();
  const bucket = String(params.bucket || "").trim();
  const contentType = String(params.contentType || "").trim();
  const lastSeenEvent = String(params.lastSeenEvent || "").trim();
  const from = toIsoDate(params.from);
  const to = toIsoDate(params.to);

  const where = [];
  const values = [];

  if (sourceId) {
    where.push("source_id = ?");
    values.push(sourceId);
  }

  if (q) {
    const searchTokens = q.split(/\s+/).filter(Boolean).slice(0, 8);
    const searchableColumns = [
      "LOWER(canonical_url)",
      "LOWER(source_id)",
      "LOWER(source_name)",
      "LOWER(bucket)",
      "LOWER(content_type)",
      "LOWER(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(refined_json, '$.name')), ''))",
      "LOWER(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(refined_json, '$.titleNormalized')), ''))",
      "LOWER(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(refined_json, '$.summary')), ''))",
      "LOWER(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(refined_json, '$.categoriesNormalized')), ''))",
      "LOWER(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(refined_json, '$.entities.tags')), ''))",
      "LOWER(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(refined_json, '$.entities.anime')), ''))",
      "LOWER(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(refined_json, '$.entities.characters')), ''))",
      "LOWER(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(refined_json, '$.entities.studios')), ''))",
    ];

    searchTokens.forEach((token) => {
      const tokenWhere = searchableColumns.map((column) => `${column} LIKE ?`).join(" OR ");
      where.push(`(${tokenWhere})`);

      const tokenLike = `%${token}%`;
      searchableColumns.forEach(() => values.push(tokenLike));
    });
  }

  if (bucket) {
    where.push("bucket = ?");
    values.push(bucket);
  }

  if (contentType) {
    where.push("content_type = ?");
    values.push(contentType);
  }

  if (lastSeenEvent) {
    where.push(
      "JSON_UNQUOTE(JSON_EXTRACT(refined_json, '$.lastSeenEvent')) = ?"
    );
    values.push(lastSeenEvent);
  }

  if (from) {
    where.push("timestamp >= ?");
    values.push(toSqlDate(from));
  }

  if (to) {
    where.push("timestamp <= ?");
    values.push(toSqlDate(to));
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const orderSql = q
    ? "ORDER BY score DESC, COALESCE(last_seen_at, timestamp) DESC, timestamp DESC"
    : "ORDER BY timestamp DESC";

  const [countRows] = await db.query(
    `SELECT COUNT(*) AS total FROM ${quoteIdentifier(TABLE_NAME)} ${whereSql}`,
    values
  );
  const total = Number(countRows?.[0]?.total || 0);

  const [rows] = await db.query(
    `SELECT id, DATE_FORMAT(timestamp, '%Y-%m-%dT%H:%i:%s.%fZ') AS timestamp, refined_json
     FROM ${quoteIdentifier(TABLE_NAME)}
     ${whereSql}
     ${orderSql}
     LIMIT ? OFFSET ?`,
    [...values, limit, offset]
  );

  const items = rows.map(parseArticleRow);
  return {
    total,
    limit,
    offset,
    hasMore: offset + items.length < total,
    items,
  };
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
  loadArticleById,
  findMatchingArticle,
  queryArticles,
  saveAllArticlesSnapshot,
};
