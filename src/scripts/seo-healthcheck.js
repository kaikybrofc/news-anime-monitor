#!/usr/bin/env node

const TARGET = process.env.SEO_TARGET || "https://animeradar.shop";
const NEWS_PATH = process.env.SEO_NEWS_PATH || "/noticias";

async function fetchText(url) {
  const res = await fetch(url, {
    headers: {
      "user-agent": "seo-healthcheck/1.0",
    },
  });
  const text = await res.text();
  return { status: res.status, text, url };
}

function has(pattern, text) {
  return pattern.test(text);
}

function fail(message) {
  console.error(`SEO CHECK FAIL: ${message}`);
  process.exitCode = 1;
}

async function main() {
  const base = await fetchText(TARGET);
  if (base.status !== 200) fail(`Home retornou status ${base.status}`);

  const news = await fetchText(`${TARGET}${NEWS_PATH}`);
  if (news.status !== 200) fail(`/noticias retornou status ${news.status}`);

  const requiredOnNews = [
    [/<title>[^<]+<\/title>/i, "title ausente em /noticias"],
    [/<link rel="canonical" href="[^"]+"/i, "canonical ausente em /noticias"],
    [/<script type="application\/ld\+json">/i, "JSON-LD ausente em /noticias"],
  ];
  for (const [pattern, msg] of requiredOnNews) {
    if (!has(pattern, news.text)) fail(msg);
  }

  const newsLinks = Array.from(
    news.text.matchAll(/href="(\/noticias\/[^"]+)"/g),
    (m) => m[1]
  ).slice(0, 5);

  if (!newsLinks.length) {
    fail("Nenhuma notícia encontrada para validar SEO.");
    return;
  }

  for (const path of newsLinks) {
    const page = await fetchText(`${TARGET}${path}`);
    if (page.status !== 200) {
      fail(`${path} retornou status ${page.status}`);
      continue;
    }

    const checks = [
      [/<h1[^>]*>[^<]+<\/h1>/i, "H1 ausente"],
      [/<meta name="description" content="[^"]+"/i, "meta description ausente"],
      [/<meta property="og:title" content="[^"]+"/i, "og:title ausente"],
      [/<meta property="og:description" content="[^"]+"/i, "og:description ausente"],
      [/<meta name="twitter:card" content="[^"]+"/i, "twitter:card ausente"],
      [/"@type":"NewsArticle"/i, "schema NewsArticle ausente"],
      [/"@type":"BreadcrumbList"/i, "schema BreadcrumbList ausente"],
    ];

    for (const [pattern, message] of checks) {
      if (!has(pattern, page.text)) fail(`${path}: ${message}`);
    }
  }

  if (!process.exitCode) {
    console.log("SEO CHECK OK");
  }
}

main().catch((error) => {
  fail(error?.message || String(error));
});

