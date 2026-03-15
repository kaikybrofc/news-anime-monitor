const {
  hasDbConfig,
  getPool,
  pingDatabase,
} = require("./mysql.js");

const TABLE_NAME = "articles";
const FRANCHISE_SLUG_SQL = `
COALESCE(
  NULLIF(LOWER(JSON_UNQUOTE(JSON_EXTRACT(refined_json, '$.franchiseSlug'))), ''),
  NULLIF(
    LOWER(
      SUBSTRING_INDEX(
        SUBSTRING_INDEX(JSON_UNQUOTE(JSON_EXTRACT(refined_json, '$.topicKey')), '|', 2),
        '|',
        -1
      )
    ),
    ''
  )
)
`;

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

function normalizeOffset(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.floor(parsed);
}

function buildWindowFilter(windowHours) {
  const parsedWindow = Number(windowHours);
  if (!Number.isFinite(parsedWindow) || parsedWindow <= 0) {
    return {
      whereSql: "",
      values: [],
    };
  }

  return {
    whereSql:
      "WHERE COALESCE(last_seen_at, timestamp) >= DATE_SUB(UTC_TIMESTAMP(3), INTERVAL ? HOUR)",
    values: [Math.floor(parsedWindow)],
  };
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return parsed;
}

function parseFranchiseSummaryRow(row = {}) {
  return {
    slug: String(row.slug || ""),
    name: String(row.name || ""),
    mentions: toNumber(row.mentions, 0),
    sourceCount: toNumber(row.sourceCount, 0),
    avgScore: toNumber(row.avgScore, 0),
    maxTrendScore: toNumber(row.maxTrendScore, 0),
    lastSeenAt: String(row.lastSeenAt || ""),
  };
}

async function ensureLeadingColumnIndex(db, columnName, fallbackIndexName) {
  const safeColumn = String(columnName || "").trim();
  const safeIndexName = String(fallbackIndexName || "").trim();
  if (!safeColumn || !safeIndexName) return;

  const [rows] = await db.query(
    `
      SELECT 1
      FROM INFORMATION_SCHEMA.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND COLUMN_NAME = ?
        AND SEQ_IN_INDEX = 1
      LIMIT 1
    `,
    [TABLE_NAME, safeColumn]
  );

  if (rows.length) return;

  await db.query(
    `ALTER TABLE ${quoteIdentifier(TABLE_NAME)} ADD INDEX ${quoteIdentifier(
      safeIndexName
    )} (${quoteIdentifier(safeColumn)})`
  );
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

  await ensureLeadingColumnIndex(db, "source_id", "idx_source_id");
  await ensureLeadingColumnIndex(db, "last_seen_at", "idx_last_seen_at");
  await ensureLeadingColumnIndex(db, "content_type", "idx_content_type");
  await ensureLeadingColumnIndex(db, "score", "idx_score");
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

function buildFranchiseGroupedSql(windowWhereSql = "") {
  return `
    SELECT
      base.slug AS slug,
      MAX(base.name) AS name,
      COUNT(*) AS mentions,
      COUNT(DISTINCT base.source_id) AS sourceCount,
      ROUND(AVG(base.score), 2) AS avgScore,
      ROUND(MAX(base.topic_trend_score), 2) AS maxTrendScore,
      DATE_FORMAT(MAX(base.seen_at), '%Y-%m-%dT%H:%i:%s.%fZ') AS lastSeenAt
    FROM (
      SELECT
        ${FRANCHISE_SLUG_SQL} AS slug,
        NULLIF(JSON_UNQUOTE(JSON_EXTRACT(refined_json, '$.franchiseName')), '') AS name,
        source_id,
        score,
        CAST(
          COALESCE(
            NULLIF(JSON_UNQUOTE(JSON_EXTRACT(refined_json, '$.topicTrendScore')), ''),
            '0'
          ) AS DECIMAL(12, 2)
        ) AS topic_trend_score,
        COALESCE(last_seen_at, timestamp) AS seen_at
      FROM ${quoteIdentifier(TABLE_NAME)}
      ${windowWhereSql}
    ) base
    WHERE base.slug IS NOT NULL
      AND base.slug <> ''
      AND base.slug <> 'na'
    GROUP BY base.slug
  `;
}

async function queryFranchiseSummary(params = {}) {
  await pingDatabase();
  const db = getPool();

  const top = normalizeLimit(params.top, 120);
  const limit = normalizeLimit(params.limit, top);
  const offset = normalizeOffset(params.offset);
  const includePagination = Boolean(params.includePagination);
  const includeRanking = params.includeRanking !== false;
  const rankingLimit = normalizeLimit(params.rankingLimit, 5);

  const { whereSql, values } = buildWindowFilter(params.windowHours);
  const groupedSql = buildFranchiseGroupedSql(whereSql);

  const [countRows] = await db.query(
    `SELECT COUNT(*) AS total FROM (${groupedSql}) grouped`,
    values
  );
  const total = toNumber(countRows?.[0]?.total, 0);

  const pageLimit = includePagination ? limit : top;
  const pageOffset = includePagination ? offset : 0;
  const baseOrder = "ORDER BY mentions DESC, maxTrendScore DESC, avgScore DESC";

  const [rows] = await db.query(
    `${groupedSql}
     ${baseOrder}
     LIMIT ? OFFSET ?`,
    [...values, pageLimit, pageOffset]
  );

  const items = rows.map(parseFranchiseSummaryRow);
  const result = {
    total,
    limit: pageLimit,
    offset: pageOffset,
    hasMore: pageOffset + items.length < total,
    items,
    ranking: {
      byMentions: [],
      byAvgScore: [],
      byTrend: [],
    },
  };

  if (!includeRanking || !total) {
    return result;
  }

  const rankingQueries = [
    {
      key: "byMentions",
      orderBy: "ORDER BY mentions DESC, maxTrendScore DESC, avgScore DESC",
    },
    {
      key: "byAvgScore",
      orderBy: "ORDER BY avgScore DESC, mentions DESC, maxTrendScore DESC",
    },
    {
      key: "byTrend",
      orderBy: "ORDER BY maxTrendScore DESC, mentions DESC, avgScore DESC",
    },
  ];

  for (const rankingQuery of rankingQueries) {
    const [rankingRows] = await db.query(
      `${groupedSql}
       ${rankingQuery.orderBy}
       LIMIT ?`,
      [...values, rankingLimit]
    );
    result.ranking[rankingQuery.key] = rankingRows.map(parseFranchiseSummaryRow);
  }

  return result;
}

async function querySourceSummary(params = {}) {
  await pingDatabase();
  const db = getPool();

  const top = normalizeLimit(params.top, 200);
  const { whereSql, values } = buildWindowFilter(params.windowHours);

  const groupedSql = `
    SELECT
      source_id AS sourceId,
      COALESCE(NULLIF(source_name, ''), source_id) AS sourceName,
      COUNT(*) AS count,
      ROUND(AVG(score), 2) AS avgScore,
      SUM(
        CASE
          WHEN JSON_UNQUOTE(JSON_EXTRACT(refined_json, '$.lastSeenEvent')) = 'new'
          THEN 1
          ELSE 0
        END
      ) AS newCount,
      SUM(
        CASE
          WHEN JSON_UNQUOTE(JSON_EXTRACT(refined_json, '$.lastSeenEvent')) = 'revisited'
          THEN 1
          ELSE 0
        END
      ) AS revisitedCount,
      SUM(
        CASE
          WHEN JSON_UNQUOTE(JSON_EXTRACT(refined_json, '$.lastSeenEvent')) = 'updated'
          THEN 1
          ELSE 0
        END
      ) AS updatedCount
    FROM ${quoteIdentifier(TABLE_NAME)}
    ${whereSql}
    GROUP BY source_id, sourceName
  `;

  const [countRows] = await db.query(
    `SELECT COUNT(*) AS total FROM (${groupedSql}) grouped`,
    values
  );
  const total = toNumber(countRows?.[0]?.total, 0);

  const [rows] = await db.query(
    `${groupedSql}
     ORDER BY count DESC, avgScore DESC
     LIMIT ?`,
    [...values, top]
  );

  return {
    total,
    items: rows.map((row) => ({
      sourceId: String(row.sourceId || ""),
      sourceName: String(row.sourceName || row.sourceId || ""),
      count: toNumber(row.count, 0),
      avgScore: toNumber(row.avgScore, 0),
      newCount: toNumber(row.newCount, 0),
      revisitedCount: toNumber(row.revisitedCount, 0),
      updatedCount: toNumber(row.updatedCount, 0),
    })),
  };
}

async function queryTopicSummary(params = {}) {
  await pingDatabase();
  const db = getPool();

  const top = normalizeLimit(params.top, 30);
  const { whereSql, values } = buildWindowFilter(params.windowHours);

  const groupedSql = `
    SELECT
      base.topicKey AS topicKey,
      COUNT(*) AS mentions,
      COUNT(DISTINCT base.source_id) AS sourceCount,
      ROUND(AVG(base.score), 2) AS avgScore,
      DATE_FORMAT(MAX(base.seen_at), '%Y-%m-%dT%H:%i:%s.%fZ') AS lastSeenAt
    FROM (
      SELECT
        NULLIF(JSON_UNQUOTE(JSON_EXTRACT(refined_json, '$.topicKey')), '') AS topicKey,
        source_id,
        score,
        COALESCE(last_seen_at, timestamp) AS seen_at
      FROM ${quoteIdentifier(TABLE_NAME)}
      ${whereSql}
    ) base
    WHERE base.topicKey IS NOT NULL
      AND base.topicKey <> ''
    GROUP BY base.topicKey
  `;

  const [countRows] = await db.query(
    `SELECT COUNT(*) AS total FROM (${groupedSql}) grouped`,
    values
  );
  const total = toNumber(countRows?.[0]?.total, 0);

  const [rows] = await db.query(
    `${groupedSql}
     ORDER BY mentions DESC, avgScore DESC
     LIMIT ?`,
    [...values, top]
  );

  return {
    total,
    items: rows.map((row) => ({
      topicKey: String(row.topicKey || ""),
      mentions: toNumber(row.mentions, 0),
      sourceCount: toNumber(row.sourceCount, 0),
      avgScore: toNumber(row.avgScore, 0),
      lastSeenAt: String(row.lastSeenAt || ""),
    })),
  };
}

async function countWindowArticles(windowHours = 72) {
  await pingDatabase();
  const db = getPool();

  const { whereSql, values } = buildWindowFilter(windowHours);
  const [rows] = await db.query(
    `SELECT COUNT(*) AS total
     FROM ${quoteIdentifier(TABLE_NAME)}
     ${whereSql}`,
    values
  );

  return toNumber(rows?.[0]?.total, 0);
}

async function queryTrendSnapshot(params = {}) {
  const top = normalizeLimit(params.top, 10);
  const windowHours = Number(params.windowHours);

  const [articlesTotal, sources, franchises, topics] = await Promise.all([
    countWindowArticles(windowHours),
    querySourceSummary({ top, windowHours }),
    queryFranchiseSummary({
      top,
      windowHours,
      includePagination: false,
      includeRanking: false,
    }),
    queryTopicSummary({ top, windowHours }),
  ]);

  return {
    totals: {
      articles: articlesTotal,
      sources: sources.total,
      franchises: franchises.total,
      topics: topics.total,
    },
    topSources: sources.items,
    topFranchises: franchises.items,
    topTopics: topics.items,
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
  queryFranchiseSummary,
  querySourceSummary,
  queryTopicSummary,
  queryTrendSnapshot,
  saveAllArticlesSnapshot,
};
