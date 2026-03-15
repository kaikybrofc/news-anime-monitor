const mysql = require("mysql2/promise");
const { toPositiveInt } = require("../utils/http.js");

function requiredEnv(name) {
  const value = String(process.env[name] || "").trim();
  if (!value) {
    throw new Error(`Variável de ambiente obrigatória ausente: ${name}`);
  }
  return value;
}

function buildDbConfig({ includeDatabase = true } = {}) {
  const host = requiredEnv("DB_HOST");
  const user = requiredEnv("DB_USER");
  const password = String(process.env.DB_PASSWORD || "");
  const database = String(process.env.DB_NAME || "").trim();
  const poolLimit = toPositiveInt(process.env.DB_POOL_LIMIT, 10);

  const config = {
    host,
    user,
    password,
    connectionLimit: poolLimit,
    waitForConnections: true,
    queueLimit: 0,
    charset: "utf8mb4",
    timezone: "Z",
    dateStrings: true,
  };

  if (includeDatabase && database) {
    config.database = database;
  }

  return config;
}

let pool = null;

function hasDbConfig() {
  return Boolean(
    String(process.env.DB_HOST || "").trim() &&
      String(process.env.DB_USER || "").trim() &&
      String(process.env.DB_NAME || "").trim()
  );
}

function getPool() {
  if (!pool) {
    pool = mysql.createPool(buildDbConfig({ includeDatabase: true }));
  }

  return pool;
}

async function pingDatabase() {
  const db = getPool();
  await db.query("SELECT 1");
}

async function closePool() {
  if (!pool) return;
  await pool.end();
  pool = null;
}

module.exports = {
  hasDbConfig,
  getPool,
  pingDatabase,
  closePool,
};
