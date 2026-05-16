"use client";

import { useEffect } from "react";

function buildSessionId() {
  const now = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 10);
  return `avs_${now}_${rand}`;
}

function getSessionId() {
  const key = "anime_radar_visit_session_id";
  try {
    const existing = window.localStorage.getItem(key);
    if (existing) return existing;
    const created = buildSessionId();
    window.localStorage.setItem(key, created);
    return created;
  } catch {
    return buildSessionId();
  }
}

function parseUtmParams() {
  try {
    const params = new URLSearchParams(window.location.search);
    return {
      utmSource: params.get("utm_source") || "",
      utmMedium: params.get("utm_medium") || "",
      utmCampaign: params.get("utm_campaign") || "",
      utmTerm: params.get("utm_term") || "",
      utmContent: params.get("utm_content") || "",
    };
  } catch {
    return {
      utmSource: "",
      utmMedium: "",
      utmCampaign: "",
      utmTerm: "",
      utmContent: "",
    };
  }
}

function detectDeviceType() {
  const ua = String(navigator.userAgent || "").toLowerCase();
  if (/ipad|tablet|playbook|silk/.test(ua)) return "tablet";
  if (/mobi|android|iphone|ipod/.test(ua)) return "mobile";
  return "desktop";
}

async function postVisit(payload) {
  try {
    await fetch("/api/track/visit", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
      keepalive: true,
    });
  } catch {
    // noop
  }
}

export function ArticleVisitTracker({ articleId = "", articleSlug = "" }) {
  useEffect(() => {
    const safeArticleId = String(articleId || "").trim();
    if (!safeArticleId) return undefined;

    const sessionId = getSessionId();
    const startedAt = Date.now();
    const maxScroll = { value: 0 };
    const utm = parseUtmParams();
    let sentEngagement = false;

    const buildBasePayload = () => ({
      articleId: safeArticleId,
      articleSlug: String(articleSlug || "").trim(),
      path: window.location.pathname,
      sessionId,
      referrer: document.referrer || "",
      deviceType: detectDeviceType(),
      ...utm,
    });

    const onScroll = () => {
      const doc = document.documentElement;
      const maxY = Math.max(1, doc.scrollHeight - window.innerHeight);
      const pct = Math.round((window.scrollY / maxY) * 100);
      if (pct > maxScroll.value) {
        maxScroll.value = Math.min(100, Math.max(0, pct));
      }
    };

    const sendEngagement = () => {
      if (sentEngagement) return;
      sentEngagement = true;
      const elapsed = Math.max(0, Date.now() - startedAt);
      postVisit({
        ...buildBasePayload(),
        eventType: "engagement",
        timeOnPageMs: elapsed,
        scrollDepthPct: maxScroll.value,
        eventAt: new Date().toISOString(),
      });
    };

    postVisit({
      ...buildBasePayload(),
      eventType: "pageview",
      eventAt: new Date().toISOString(),
    });

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("beforeunload", sendEngagement);
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        sendEngagement();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("beforeunload", sendEngagement);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      sendEngagement();
    };
  }, [articleId, articleSlug]);

  return null;
}
