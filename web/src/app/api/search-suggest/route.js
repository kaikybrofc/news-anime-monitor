import { NextResponse } from "next/server";
import { fetchMonitor } from "@/lib/api";
import {
  getArticleDetailPath,
  getArticleTitle,
  summarizeText,
} from "@/lib/formatters";

export const dynamic = "force-dynamic";

const MIN_QUERY_LENGTH = 2;
const MAX_ITEMS = 12;
const MAX_ARTICLES = 6;
const MAX_FRANCHISES = 4;
const MAX_SOURCES = 4;

function normalizeToAscii(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function normalizeText(value = "") {
  return normalizeToAscii(value).toLowerCase().trim();
}

function splitTokens(value = "") {
  return normalizeText(value)
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

function matchesQuery(value = "", query = "") {
  const haystack = normalizeText(value);
  const tokens = splitTokens(query);
  if (!tokens.length) return false;
  return tokens.every((token) => haystack.includes(token));
}

function toArticleSuggestion(article = {}) {
  const refined = article?.refined || {};
  const title = getArticleTitle(article);
  if (!title) return null;

  const sourceName = String(refined.sourceName || refined.sourceId || "").trim();
  const summary = summarizeText(refined.summary || "", 110);
  const subtitleParts = [sourceName, summary].filter(Boolean);

  return {
    id: `noticia:${article.id}`,
    type: "noticia",
    title,
    subtitle: subtitleParts.join(" · "),
    href: getArticleDetailPath(article),
  };
}

function toFranchiseSuggestion(item = {}) {
  const slug = String(item?.slug || "").trim();
  const name = String(item?.name || "").trim();
  if (!slug || !name) return null;

  const mentionsValue = Number(item?.mentions);
  const mentions = Number.isFinite(mentionsValue) ? mentionsValue : 0;
  const avgScoreValue = Number(item?.avgScore);
  const avgScore = Number.isFinite(avgScoreValue) ? avgScoreValue : 0;

  return {
    id: `franquia:${slug}`,
    type: "franquia",
    title: name,
    subtitle: `${mentions} menções · score médio ${avgScore.toFixed(1)}`,
    href: `/franquias/${slug}`,
  };
}

function toSourceSuggestion(item = {}) {
  const sourceId = String(item?.id || "").trim();
  const name = String(item?.name || "").trim();
  if (!sourceId || !name) return null;

  const countValue = Number(item?.stats?.count);
  const count = Number.isFinite(countValue) ? countValue : 0;

  return {
    id: `fonte:${sourceId}`,
    type: "fonte",
    title: name,
    subtitle: `${count} notícias monitoradas`,
    href: `/fontes/${sourceId}`,
  };
}

function uniqueByHref(items = []) {
  const seen = new Set();
  const unique = [];

  for (const item of items) {
    const href = String(item?.href || "").trim();
    if (!href || seen.has(href)) continue;
    seen.add(href);
    unique.push(item);
  }

  return unique;
}

export async function GET(request) {
  const url = new URL(request.url);
  const q = String(url.searchParams.get("q") || "").trim();

  if (q.length < MIN_QUERY_LENGTH) {
    return NextResponse.json(
      {
        query: q,
        minLength: MIN_QUERY_LENGTH,
        items: [],
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  }

  const [articlesResult, franchisesResult, sourcesResult] =
    await Promise.allSettled([
      fetchMonitor("/articles", { limit: MAX_ARTICLES, offset: 0, q }),
      fetchMonitor("/franchises", { top: 180 }),
      fetchMonitor("/sources", { top: 180 }),
    ]);

  const articleItems =
    articlesResult.status === "fulfilled"
      ? articlesResult.value?.items || []
      : [];
  const franchiseItems =
    franchisesResult.status === "fulfilled"
      ? franchisesResult.value?.items || []
      : [];
  const sourceItems =
    sourcesResult.status === "fulfilled"
      ? sourcesResult.value?.items || []
      : [];

  const suggestions = [];

  articleItems.forEach((article) => {
    const suggestion = toArticleSuggestion(article);
    if (!suggestion) return;
    suggestions.push(suggestion);
  });

  franchiseItems
    .filter((item) => {
      const text = `${item?.name || ""} ${item?.slug || ""}`;
      return matchesQuery(text, q);
    })
    .slice(0, MAX_FRANCHISES)
    .forEach((item) => {
      const suggestion = toFranchiseSuggestion(item);
      if (!suggestion) return;
      suggestions.push(suggestion);
    });

  sourceItems
    .filter((item) => {
      const text = `${item?.name || ""} ${item?.id || ""}`;
      return matchesQuery(text, q);
    })
    .slice(0, MAX_SOURCES)
    .forEach((item) => {
      const suggestion = toSourceSuggestion(item);
      if (!suggestion) return;
      suggestions.push(suggestion);
    });

  const items = uniqueByHref(suggestions).slice(0, MAX_ITEMS);

  return NextResponse.json(
    {
      query: q,
      minLength: MIN_QUERY_LENGTH,
      items,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
