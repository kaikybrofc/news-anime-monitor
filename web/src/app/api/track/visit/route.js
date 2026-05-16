import { NextResponse } from "next/server";
import { getMonitorApiBaseUrls } from "@/lib/api";

export const dynamic = "force-dynamic";

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

  const bases = getMonitorApiBaseUrls();
  const errors = [];

  for (const baseUrl of bases) {
    try {
      const target = new URL("/analytics/visits", `${baseUrl}/`);
      const response = await fetch(target.toString(), {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(payload),
        cache: "no-store",
      });

      if (!response.ok) {
        let detail = "";
        try {
          const json = await response.json();
          detail = json?.error ? ` ${json.error}` : "";
        } catch {
          detail = "";
        }
        errors.push(`Erro ${response.status} em ${target.pathname}.${detail}`);
        continue;
      }

      return NextResponse.json({ ok: true }, { status: 202 });
    } catch (error) {
      errors.push(String(error?.message || error));
    }
  }

  return NextResponse.json(
    { error: "Falha ao registrar visita.", details: errors.slice(0, 3) },
    { status: 502 }
  );
}
