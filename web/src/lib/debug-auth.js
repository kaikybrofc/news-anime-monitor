import crypto from "node:crypto";
import { cookies } from "next/headers";
import { getEnvValue } from "@/lib/root-env";

export const DEBUG_SESSION_COOKIE = "omnizap_debug_session";

function toPositiveInt(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

function getSessionSecret() {
  return (
    getEnvValue("DEBUG_DASHBOARD_SECRET") ||
    getEnvValue("DEBUG_DASHBOARD_PASSWORD") ||
    "omnizap-debug-fallback-secret"
  );
}

function getSessionTtlHours() {
  return toPositiveInt(getEnvValue("DEBUG_DASHBOARD_TTL_HOURS"), 8);
}

function safeCompare(left = "", right = "") {
  const leftBuffer = Buffer.from(String(left || ""));
  const rightBuffer = Buffer.from(String(right || ""));

  if (!leftBuffer.length || !rightBuffer.length) return false;
  if (leftBuffer.length !== rightBuffer.length) return false;

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function signPayload(encodedPayload) {
  const secret = getSessionSecret();
  return crypto
    .createHmac("sha256", secret)
    .update(String(encodedPayload || ""))
    .digest("base64url");
}

function buildSessionToken() {
  const now = Date.now();
  const ttlMs = getSessionTtlHours() * 60 * 60 * 1000;
  const payload = {
    iat: now,
    exp: now + ttlMs,
  };

  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = signPayload(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

function verifySessionToken(token = "") {
  const raw = String(token || "").trim();
  if (!raw || !raw.includes(".")) return false;

  const [encodedPayload, signature] = raw.split(".");
  if (!encodedPayload || !signature) return false;

  const expectedSignature = signPayload(encodedPayload);
  if (!safeCompare(signature, expectedSignature)) return false;

  try {
    const payloadJson = Buffer.from(encodedPayload, "base64url").toString("utf8");
    const payload = JSON.parse(payloadJson);
    const now = Date.now();
    return Number(payload?.exp || 0) > now;
  } catch {
    return false;
  }
}

export function getDebugDashboardPassword() {
  return String(getEnvValue("DEBUG_DASHBOARD_PASSWORD")).trim();
}

export function isDebugPasswordValid(inputPassword = "") {
  const configuredPassword = getDebugDashboardPassword();
  if (!configuredPassword) return false;
  return safeCompare(String(inputPassword || ""), configuredPassword);
}

export function createDebugSessionCookie() {
  const token = buildSessionToken();
  return {
    name: DEBUG_SESSION_COOKIE,
    value: token,
    options: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: getSessionTtlHours() * 60 * 60,
    },
  };
}

export async function isDebugSessionAuthenticated() {
  const cookieStore = await cookies();
  const token = cookieStore.get(DEBUG_SESSION_COOKIE)?.value || "";
  return verifySessionToken(token);
}
