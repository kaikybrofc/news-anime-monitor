#!/usr/bin/env node

const SITE_BASE_URL = String(
  process.env.SEO_SITE_BASE_URL || "https://animeradar.shop"
).replace(/\/+$/, "");
const API_BASE_URL = String(
  process.env.SEO_API_BASE_URL || `${SITE_BASE_URL}/monitor-api`
).replace(/\/+$/, "");
const NEWS_LIMIT = Math.max(1, Number(process.env.SEO_NEWS_LIMIT || 5));
const MIN_DESC_LEN = Math.max(80, Number(process.env.SEO_MIN_DESC_LEN || 120));

function fail(message) {
  console.error(`SEO NEWS CHECK FAIL: ${message}`);
  process.exitCode = 1;
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "seo-news-metadata-check/1.0",
    },
  });
  const text = await response.text();
  return {
    ok: response.ok,
    status: response.status,
    text,
    url,
  };
}

function readMetaContentByRegex(regex, html) {
  const match = String(html || "").match(regex);
  return match ? String(match[1] || "").trim() : "";
}

function decodeHtmlEntities(value = "") {
  return String(value || "")
    .replace(/&#(\d+);/g, (_match, dec) => String.fromCharCode(Number(dec)))
    .replace(/&#x([0-9a-f]+);/gi, (_match, hex) =>
      String.fromCharCode(parseInt(hex, 16))
    )
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

async function main() {
  const apiUrl = `${API_BASE_URL}/articles?limit=${NEWS_LIMIT}&offset=0`;
  const apiResponse = await fetchText(apiUrl);
  if (!apiResponse.ok) {
    fail(`API de artigos retornou status ${apiResponse.status}: ${apiUrl}`);
    return;
  }

  let payload = null;
  try {
    payload = JSON.parse(apiResponse.text);
  } catch (error) {
    fail(`Falha ao parsear JSON da API de artigos: ${error?.message || error}`);
    return;
  }

  const items = Array.isArray(payload?.items) ? payload.items : [];
  const slugs = items
    .map((item) => String(item?.refined?.newsSlug || "").trim())
    .filter(Boolean)
    .slice(0, NEWS_LIMIT);

  if (!slugs.length) {
    fail("Nenhum slug de notícia encontrado na API.");
    return;
  }

  for (const slug of slugs) {
    const pageUrl = `${SITE_BASE_URL}/noticias/${encodeURIComponent(slug)}`;
    const page = await fetchText(pageUrl);
    if (!page.ok) {
      fail(`${slug}: página retornou status ${page.status}`);
      continue;
    }

    const html = page.text;
    const canonical = readMetaContentByRegex(
      /<link rel="canonical" href="([^"]+)"/i,
      html
    );
    const description = decodeHtmlEntities(
      readMetaContentByRegex(
        /<meta name="description" content="([^"]*)"/i,
        html
      )
    );
    const robots = readMetaContentByRegex(
      /<meta name="robots" content="([^"]*)"/i,
      html
    )
      .toLowerCase()
      .replace(/\s+/g, "");
    const ogTitle = decodeHtmlEntities(
      readMetaContentByRegex(
        /<meta property="og:title" content="([^"]*)"/i,
        html
      )
    );
    const ogDescription = decodeHtmlEntities(
      readMetaContentByRegex(
        /<meta property="og:description" content="([^"]*)"/i,
        html
      )
    );
    const ogImage = readMetaContentByRegex(
      /<meta property="og:image" content="([^"]*)"/i,
      html
    );
    const twitterCard = readMetaContentByRegex(
      /<meta name="twitter:card" content="([^"]*)"/i,
      html
    );

    const expectedCanonical = `${SITE_BASE_URL}/noticias/${slug}`;
    if (!canonical) fail(`${slug}: canonical ausente.`);
    if (canonical && canonical !== expectedCanonical) {
      fail(`${slug}: canonical diferente do esperado (${canonical}).`);
    }

    if (!description) fail(`${slug}: meta description ausente.`);
    if (description && description.length < MIN_DESC_LEN) {
      fail(
        `${slug}: description muito curta (${description.length} chars, mínimo ${MIN_DESC_LEN}).`
      );
    }

    if (!robots) fail(`${slug}: meta robots ausente.`);
    if (robots && robots !== "index,follow") {
      fail(`${slug}: robots inválido (${robots}), esperado index,follow.`);
    }

    if (!ogTitle) fail(`${slug}: og:title ausente.`);
    if (!ogDescription) fail(`${slug}: og:description ausente.`);
    if (!ogImage) fail(`${slug}: og:image ausente.`);
    if (!twitterCard) fail(`${slug}: twitter:card ausente.`);

    if (!/"@type":"NewsArticle"/i.test(html)) {
      fail(`${slug}: schema NewsArticle ausente.`);
    }
  }

  if (!process.exitCode) {
    console.log("SEO NEWS CHECK OK");
    console.log(
      `Validadas ${slugs.length} notícia(s) em ${SITE_BASE_URL} (description mínima: ${MIN_DESC_LEN}).`
    );
  }
}

main().catch((error) => {
  fail(error?.message || String(error));
});

