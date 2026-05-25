import { NextResponse } from "next/server";
import { getMonitorApiBaseUrls } from "@/lib/api";

export const dynamic = "force-dynamic";
const VISITOR_COOKIE_NAME = "anime_radar_vid";
const VISITOR_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 180;

function buildVisitorId() {
  const now = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 12);
  return `arv_${now}_${rand}`;
}

function normalizePayload(input = {}) {
  if (!input || typeof input !== "object") return {};
  return {
    articleId: String(input.articleId || "").trim(),
    articleSlug: String(input.articleSlug || "").trim(),
    path: String(input.path || "").trim(),
    eventType: String(input.eventType || "pageview").trim(),
    sessionId: String(input.sessionId || "").trim(),
    referrer: String(input.referrer || "").trim(),
    utmSource: String(input.utmSource || "").trim(),
    utmMedium: String(input.utmMedium || "").trim(),
    utmCampaign: String(input.utmCampaign || "").trim(),
    utmTerm: String(input.utmTerm || "").trim(),
    utmContent: String(input.utmContent || "").trim(),
    deviceType: String(input.deviceType || "").trim(),
    browser: String(input.browser || "").trim(),
    os: String(input.os || "").trim(),
    countryCode: String(input.countryCode || "").trim(),
    region: String(input.region || "").trim(),
    city: String(input.city || "").trim(),
    timeOnPageMs: Number(input.timeOnPageMs || 0),
    scrollDepthPct: Number(input.scrollDepthPct || 0),
    clickedOutbound: Boolean(input.clickedOutbound),
    eventAt: String(input.eventAt || "").trim(),
  };
}

export async function POST(request) {
  let payload = {};
  try {
    payload = normalizePayload(await request.json());
  } catch {
    return NextResponse.json({ error: "Payload JSON inválido." }, { status: 400 });
  }

  if (!payload.articleId) {
    return NextResponse.json({ error: "articleId é obrigatório." }, { status: 400 });
  }

  const visitorIdFromCookie = String(
    request.cookies.get(VISITOR_COOKIE_NAME)?.value || ""
  ).trim();
  const visitorId = visitorIdFromCookie || buildVisitorId();
  payload.sessionId = visitorId;

  const bases = getMonitorApiBaseUrls();
  const errors = [];

  for (const baseUrl of bases) {
    try {
      const target = new URL("/analytics/visits", `${baseUrl}/`);
      const upstreamResponse = await fetch(target.toString(), {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(payload),
        cache: "no-store",
      });

      if (!upstreamResponse.ok) {
        let detail = "";
        try {
          const json = await upstreamResponse.json();
          detail = json?.error ? ` ${json.error}` : "";
        } catch {
          detail = "";
        }
        errors.push(`Erro ${upstreamResponse.status} em ${target.pathname}.${detail}`);
        continue;
      }

      const response = NextResponse.json({ ok: true }, { status: 202 });
      if (!visitorIdFromCookie) {
        response.cookies.set({
          name: VISITOR_COOKIE_NAME,
          value: visitorId,
          httpOnly: true,
          sameSite: "lax",
          secure: true,
          path: "/",
          maxAge: VISITOR_COOKIE_MAX_AGE_SECONDS,
        });
      }
      return response;
    } catch (error) {
      errors.push(String(error?.message || error));
    }
  }

  const failureResponse = NextResponse.json(
    { error: "Falha ao registrar visita.", details: errors.slice(0, 3) },
    { status: 502 }
  );
  if (!visitorIdFromCookie) {
    failureResponse.cookies.set({
      name: VISITOR_COOKIE_NAME,
      value: visitorId,
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      path: "/",
      maxAge: VISITOR_COOKIE_MAX_AGE_SECONDS,
    });
  }
  return failureResponse;
}
