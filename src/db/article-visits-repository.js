const crypto = require("crypto");
const { hasDbConfig, getPool, pingDatabase } = require("./mysql.js");

const EVENTS_TABLE = "article_visits_events";
const DAILY_TABLE = "article_visits_daily";

function quoteIdentifier(name) {
  return `\`${String(name || "").replace(/`/g, "``")}\``;
}

function toSqlDate(value) {
  const parsed = Date.parse(String(value || ""));
  const date = Number.isNaN(parsed) ? new Date() : new Date(parsed);
  return date.toISOString().slice(0, 23).replace("T", " ");
}

function normalizeText(value = "", maxLength = 255) {
  return String(value || "").trim().slice(0, maxLength);
}

function normalizeInt(value, fallback = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.floor(parsed);
}

function parseDeviceType(userAgent = "") {
  const ua = String(userAgent || "").toLowerCase();
  if (!ua) return "unknown";
  if (/ipad|tablet|playbook|silk/.test(ua)) return "tablet";
  if (/mobi|android|iphone|ipod/.test(ua)) return "mobile";
  return "desktop";
}

function parseOs(userAgent = "") {
  const ua = String(userAgent || "");
  if (/Windows NT/i.test(ua)) return "Windows";
  if (/Android/i.test(ua)) return "Android";
  if (/iPhone|iPad|iPod/i.test(ua)) return "iOS";
  if (/Mac OS X|Macintosh/i.test(ua)) return "macOS";
  if (/Linux/i.test(ua)) return "Linux";
  return "Unknown";
}

function parseBrowser(userAgent = "") {
  const ua = String(userAgent || "");
  if (/Edg\//i.test(ua)) return "Edge";
  if (/OPR\//i.test(ua) || /Opera/i.test(ua)) return "Opera";
  if (/Chrome\//i.test(ua) && !/Edg\//i.test(ua)) return "Chrome";
  if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) return "Safari";
  if (/Firefox\//i.test(ua)) return "Firefox";
  return "Unknown";
}

function parseDomain(rawUrl = "") {
  try {
    return String(new URL(String(rawUrl || "")).hostname || "").toLowerCase();
  } catch {
    return "";
  }
}

function toUtcDateOnly(isoDate = "") {
  const parsed = Date.parse(String(isoDate || ""));
  const date = Number.isNaN(parsed) ? new Date() : new Date(parsed);
  return date.toISOString().slice(0, 10);
}

function hashVisitor({ ip = "", userAgent = "", salt = "" } = {}) {
  const basis = `${String(ip || "").trim()}|${String(userAgent || "").trim()}|${String(salt || "").trim()}`;
  return crypto.createHash("sha256").update(basis).digest("hex");
}

function isLikelyBot(userAgent = "") {
  const ua = String(userAgent || "").toLowerCase();
  if (!ua) return false;
  return /bot|crawler|spider|crawling|preview|facebookexternalhit|headless/i.test(ua);
}

async function ensureVisitsTables() {
  if (!hasDbConfig()) {
    throw new Error(
      "Configuração de MySQL ausente. Defina DB_HOST, DB_USER, DB_PASSWORD, DB_NAME."
    );
  }

  await pingDatabase();
  const db = getPool();

  await db.query(`
    CREATE TABLE IF NOT EXISTS ${quoteIdentifier(EVENTS_TABLE)} (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      event_at DATETIME(3) NOT NULL,
      article_id CHAR(40) NOT NULL,
      article_slug VARCHAR(191) NOT NULL DEFAULT '',
      path VARCHAR(512) NOT NULL DEFAULT '',
      event_type VARCHAR(32) NOT NULL DEFAULT 'pageview',
      visitor_hash CHAR(64) NOT NULL,
      session_id VARCHAR(128) NOT NULL DEFAULT '',
      referrer VARCHAR(1024) NOT NULL DEFAULT '',
      referrer_domain VARCHAR(255) NOT NULL DEFAULT '',
      utm_source VARCHAR(128) NOT NULL DEFAULT '',
      utm_medium VARCHAR(128) NOT NULL DEFAULT '',
      utm_campaign VARCHAR(128) NOT NULL DEFAULT '',
      utm_term VARCHAR(128) NOT NULL DEFAULT '',
      utm_content VARCHAR(128) NOT NULL DEFAULT '',
      device_type VARCHAR(16) NOT NULL DEFAULT 'unknown',
      browser VARCHAR(64) NOT NULL DEFAULT 'Unknown',
      os VARCHAR(64) NOT NULL DEFAULT 'Unknown',
      user_agent VARCHAR(512) NOT NULL DEFAULT '',
      country_code CHAR(2) NOT NULL DEFAULT '',
      region VARCHAR(128) NOT NULL DEFAULT '',
      city VARCHAR(128) NOT NULL DEFAULT '',
      is_bot TINYINT(1) NOT NULL DEFAULT 0,
      time_on_page_ms INT NOT NULL DEFAULT 0,
      scroll_depth_pct TINYINT UNSIGNED NOT NULL DEFAULT 0,
      clicked_outbound TINYINT(1) NOT NULL DEFAULT 0,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      KEY idx_article_event_at (article_id, event_at),
      KEY idx_event_type (event_type),
      KEY idx_visitor_hash (visitor_hash),
      KEY idx_session_id (session_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS ${quoteIdentifier(DAILY_TABLE)} (
      day DATE NOT NULL,
      article_id CHAR(40) NOT NULL,
      pageviews INT NOT NULL DEFAULT 0,
      unique_visitors INT NOT NULL DEFAULT 0,
      avg_time_on_page_ms INT NOT NULL DEFAULT 0,
      avg_scroll_depth_pct TINYINT UNSIGNED NOT NULL DEFAULT 0,
      outbound_clicks INT NOT NULL DEFAULT 0,
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      PRIMARY KEY (day, article_id),
      KEY idx_article_day (article_id, day)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

async function recordArticleVisit(input = {}) {
  await pingDatabase();
  const db = getPool();
  const conn = await db.getConnection();

  const eventAtIso = String(input.eventAt || new Date().toISOString());
  const day = toUtcDateOnly(eventAtIso);
  const visitorHash = hashVisitor({
    ip: input.ip,
    userAgent: input.userAgent,
    salt: process.env.VISITOR_HASH_SALT || process.env.DEBUG_SOURCES_TOKEN || "news-anime-monitor",
  });
  const sessionId = normalizeText(input.sessionId, 128);
  const eventType = normalizeText(input.eventType || "pageview", 32) || "pageview";
  const referrer = normalizeText(input.referrer, 1024);
  const ua = normalizeText(input.userAgent, 512);
  const timeOnPageMs = Math.max(0, normalizeInt(input.timeOnPageMs, 0));
  const scrollDepthPct = Math.max(
    0,
    Math.min(100, normalizeInt(input.scrollDepthPct, 0))
  );
  const clickedOutbound = input.clickedOutbound ? 1 : 0;

  try {
    await conn.beginTransaction();

    await conn.query(
      `
        INSERT INTO ${quoteIdentifier(EVENTS_TABLE)} (
          event_at, article_id, article_slug, path, event_type,
          visitor_hash, session_id, referrer, referrer_domain,
          utm_source, utm_medium, utm_campaign, utm_term, utm_content,
          device_type, browser, os, user_agent,
          country_code, region, city,
          is_bot, time_on_page_ms, scroll_depth_pct, clicked_outbound
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        toSqlDate(eventAtIso),
        normalizeText(input.articleId, 40),
        normalizeText(input.articleSlug, 191),
        normalizeText(input.path, 512),
        eventType,
        visitorHash,
        sessionId,
        referrer,
        normalizeText(parseDomain(referrer), 255),
        normalizeText(input.utmSource, 128),
        normalizeText(input.utmMedium, 128),
        normalizeText(input.utmCampaign, 128),
        normalizeText(input.utmTerm, 128),
        normalizeText(input.utmContent, 128),
        normalizeText(input.deviceType || parseDeviceType(ua), 16) || "unknown",
        normalizeText(input.browser || parseBrowser(ua), 64) || "Unknown",
        normalizeText(input.os || parseOs(ua), 64) || "Unknown",
        ua,
        normalizeText(input.countryCode, 2).toUpperCase(),
        normalizeText(input.region, 128),
        normalizeText(input.city, 128),
        isLikelyBot(ua) ? 1 : 0,
        timeOnPageMs,
        scrollDepthPct,
        clickedOutbound,
      ]
    );

    await conn.query(
      `
        INSERT INTO ${quoteIdentifier(DAILY_TABLE)} (
          day, article_id, pageviews, unique_visitors, avg_time_on_page_ms, avg_scroll_depth_pct, outbound_clicks
        )
        SELECT
          DATE(?) AS day,
          ? AS article_id,
          COUNT(*) AS pageviews,
          COUNT(DISTINCT visitor_hash) AS unique_visitors,
          COALESCE(ROUND(AVG(NULLIF(time_on_page_ms, 0))), 0) AS avg_time_on_page_ms,
          COALESCE(ROUND(AVG(NULLIF(scroll_depth_pct, 0))), 0) AS avg_scroll_depth_pct,
          SUM(clicked_outbound) AS outbound_clicks
        FROM ${quoteIdentifier(EVENTS_TABLE)}
        WHERE article_id = ?
          AND DATE(event_at) = DATE(?)
          AND is_bot = 0
        ON DUPLICATE KEY UPDATE
          pageviews = VALUES(pageviews),
          unique_visitors = VALUES(unique_visitors),
          avg_time_on_page_ms = VALUES(avg_time_on_page_ms),
          avg_scroll_depth_pct = VALUES(avg_scroll_depth_pct),
          outbound_clicks = VALUES(outbound_clicks)
      `,
      [day, normalizeText(input.articleId, 40), normalizeText(input.articleId, 40), day]
    );

    await conn.commit();
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }

  return { ok: true };
}

module.exports = {
  ensureVisitsTables,
  recordArticleVisit,
};
