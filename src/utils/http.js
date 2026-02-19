const axios = require("axios");
const logger = require("./logger.js");

const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36";

function toPositiveInt(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

const DEFAULT_TIMEOUT_MS = toPositiveInt(process.env.HTTP_TIMEOUT_MS, 15000);
const DEFAULT_MAX_ATTEMPTS = toPositiveInt(process.env.HTTP_MAX_ATTEMPTS, 3);
const DEFAULT_RETRY_BASE_MS = toPositiveInt(process.env.HTTP_RETRY_BASE_MS, 600);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableHttpError(error) {
  const status = error?.response?.status;
  const code = error?.code;

  if (typeof status === "number") {
    return status === 408 || status === 409 || status === 425 || status === 429 || status >= 500;
  }

  return [
    "ECONNABORTED",
    "ECONNRESET",
    "ETIMEDOUT",
    "ENOTFOUND",
    "EAI_AGAIN",
    "ERR_NETWORK",
    "ERR_BAD_RESPONSE",
    "ERR_BAD_REQUEST",
  ].includes(code);
}

async function getWithRetry(url, options = {}) {
  const {
    headers,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    maxAttempts = DEFAULT_MAX_ATTEMPTS,
    retryBaseMs = DEFAULT_RETRY_BASE_MS,
    context = "HTTP",
  } = options;

  const requestConfig = {
    timeout: timeoutMs,
    headers: {
      "User-Agent": DEFAULT_USER_AGENT,
      ...(headers || {}),
    },
  };

  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await axios.get(url, requestConfig);
    } catch (error) {
      lastError = error;

      const retryable = isRetryableHttpError(error);
      const willRetry = retryable && attempt < maxAttempts;

      if (!willRetry) {
        throw error;
      }

      const delayMs = retryBaseMs * 2 ** (attempt - 1);
      const status = error?.response?.status;
      const code = error?.code || "UNKNOWN";
      logger.warn(
        `[${context}] Falha na tentativa ${attempt}/${maxAttempts} (${status || code}). Retentando em ${delayMs}ms...`
      );
      await sleep(delayMs);
    }
  }

  throw lastError;
}

module.exports = {
  DEFAULT_USER_AGENT,
  getWithRetry,
  toPositiveInt,
};
