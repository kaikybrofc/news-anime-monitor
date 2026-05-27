import { NextResponse } from "next/server";
import { fetchMonitor } from "@/lib/api";
import {
  getArticleDetailPath,
  getArticleImageUrl,
  getArticleTitle,
  summarizeText,
} from "@/lib/formatters";

export const dynamic = "force-dynamic";

const MIN_QUERY_LENGTH = 2;
const MAX_ITEMS = 12;
const MAX_ARTICLES = 20;
const MAX_FRANCHISES = 4;
const MAX_SOURCES = 4;
const MAX_QUERY_TOKENS = 8;

const QUERY_SYNONYMS = {
  bnha: ["boku", "hero", "academia", "my", "hero", "academia"],
  mha: ["my", "hero", "academia"],
  snk: ["shingeki", "no", "kyojin", "attack", "on", "titan"],
  aot: ["attack", "on", "titan", "shingeki", "no", "kyojin"],
  kimetsu: ["kimetsu", "no", "yaiba", "demon", "slayer"],
  jjk: ["jujutsu", "kaisen"],
  csm: ["chainsaw", "man"],
  op: ["one", "piece"],
  dbz: ["dragon", "ball", "z"],
  kny: ["kimetsu", "no", "yaiba"],
};

function normalizeToAscii(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function normalizeText(value = "") {
  return normalizeToAscii(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function splitTokens(value = "") {
  return normalizeText(value)
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .slice(0, MAX_QUERY_TOKENS);
}

function expandTokens(baseTokens = []) {
  const out = [];
  const seen = new Set();

  for (const token of baseTokens) {
    if (!token) continue;
    if (!seen.has(token)) {
      seen.add(token);
      out.push(token);
    }

    const mapped = QUERY_SYNONYMS[token] || [];
    for (const synonym of mapped) {
      if (!synonym || seen.has(synonym)) continue;
      seen.add(synonym);
      out.push(synonym);
    }
  }

  return out.slice(0, MAX_QUERY_TOKENS * 2);
}

function tokenMatchWeight(haystack = "", token = "") {
  if (!haystack || !token) return 0;
  if (haystack === token) return 1;
  if (haystack.startsWith(`${token} `)) return 0.96;
  if (haystack.includes(` ${token} `)) return 0.9;
  if (haystack.startsWith(token)) return 0.86;
  if (haystack.includes(token)) return 0.72;
  return 0;
}

function scoreField(fieldValue = "", tokens = [], fieldWeight = 1) {
  const normalizedField = normalizeText(fieldValue);
  if (!normalizedField || !tokens.length) return 0;

  let score = 0;
  for (const token of tokens) {
    const tokenWeight = tokenMatchWeight(normalizedField, token);
    if (!tokenWeight) continue;
    score += fieldWeight * tokenWeight;
  }
  return score;
}

function coverageRatio(tokens = [], text = "") {
  const normalized = normalizeText(text);
  if (!tokens.length || !normalized) return 0;
  let matched = 0;
  for (const token of tokens) {
    if (normalized.includes(token)) matched += 1;
  }
  return matched / tokens.length;
}

function recencyBoost(dateValue = "") {
  const parsed = Date.parse(String(dateValue || ""));
  if (!Number.isFinite(parsed)) return 0;
  const ageHours = Math.max(0, (Date.now() - parsed) / (1000 * 60 * 60));
  if (ageHours <= 24) return 1.2;
  if (ageHours <= 72) return 0.7;
  if (ageHours <= 24 * 7) return 0.35;
  if (ageHours <= 24 * 30) return 0.15;
  return 0;
}

function parseEntityBlock(entities = {}, key = "") {
  const list = entities?.[key];
  if (!Array.isArray(list)) return "";
  return list
    .map((item) => `${item?.name || ""} ${item?.slug || ""}`.trim())
    .filter(Boolean)
    .join(" ");
}

function scoreArticle(article = {}, tokens = []) {
  const refined = article?.refined || {};
  const title = getArticleTitle(article);
  const summary = String(refined.summary || "");
  const sourceName = String(refined.sourceName || refined.sourceId || "");
  const categories = String(refined.categoriesNormalized || "");
  const entities = refined.entities || {};

  let score = 0;
  score += scoreField(title, tokens, 5.2);
  score += scoreField(refined.titleNormalized || "", tokens, 4.6);
  score += scoreField(parseEntityBlock(entities, "anime"), tokens, 4.2);
  score += scoreField(parseEntityBlock(entities, "characters"), tokens, 3.8);
  score += scoreField(parseEntityBlock(entities, "studios"), tokens, 3.4);
  score += scoreField(parseEntityBlock(entities, "tags"), tokens, 2.8);
  score += scoreField(sourceName, tokens, 2.4);
  score += scoreField(categories, tokens, 2.1);
  score += scoreField(summary, tokens, 1.2);

  const mainCoverage = coverageRatio(tokens, `${title} ${refined.titleNormalized || ""}`);
  const globalCoverage = coverageRatio(
    tokens,
    `${title} ${summary} ${sourceName} ${categories} ${parseEntityBlock(entities, "anime")} ${parseEntityBlock(entities, "tags")}`
  );

  score += mainCoverage * 4;
  score += globalCoverage * 1.8;
  score += recencyBoost(refined.publishedAt || refined.lastSeenAt || article.timestamp);

  return score;
}

function scoreFranchise(item = {}, tokens = []) {
  const name = String(item?.name || "");
  const slug = String(item?.slug || "");
  const mentions = Number(item?.mentions || 0);
  const avgScore = Number(item?.avgScore || 0);
  let score = 0;

  score += scoreField(name, tokens, 4.4);
  score += scoreField(slug, tokens, 3.4);
  score += coverageRatio(tokens, `${name} ${slug}`) * 3;
  score += Math.min(mentions / 200, 1) * 0.7;
  score += Math.min(avgScore / 100, 1) * 0.6;
  return score;
}

function scoreSource(item = {}, tokens = []) {
  const id = String(item?.id || "");
  const name = String(item?.name || "");
  const count = Number(item?.stats?.count || 0);
  let score = 0;

  score += scoreField(name, tokens, 4.2);
  score += scoreField(id, tokens, 3.1);
  score += coverageRatio(tokens, `${name} ${id}`) * 2.8;
  score += Math.min(count / 300, 1) * 0.35;
  return score;
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
    imageUrl: getArticleImageUrl(article),
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
  const baseTokens = splitTokens(q);
  const searchTokens = expandTokens(baseTokens);
  const expandedAcronymQuery =
    baseTokens.length === 1 && QUERY_SYNONYMS[baseTokens[0]]
      ? QUERY_SYNONYMS[baseTokens[0]].join(" ")
      : "";
  const articlesQuery = expandedAcronymQuery || q;

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
      fetchMonitor("/articles", { limit: MAX_ARTICLES, offset: 0, q: articlesQuery }),
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
    const score = scoreArticle(article, searchTokens);
    if (score <= 0.2) return;
    suggestions.push({ ...suggestion, score });
  });

  franchiseItems
    .map((item) => {
      const suggestion = toFranchiseSuggestion(item);
      if (!suggestion) return null;
      const score = scoreFranchise(item, searchTokens);
      if (score <= 0.45) return null;
      return { ...suggestion, score };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_FRANCHISES)
    .forEach((item) => {
      suggestions.push(item);
    });

  sourceItems
    .map((item) => {
      const suggestion = toSourceSuggestion(item);
      if (!suggestion) return null;
      const score = scoreSource(item, searchTokens);
      if (score <= 0.45) return null;
      return { ...suggestion, score };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_SOURCES)
    .forEach((item) => {
      suggestions.push(item);
    });

  const typePriority = {
    noticia: 3,
    franquia: 2,
    fonte: 1,
  };

  const items = uniqueByHref(
    suggestions.sort((a, b) => {
      const byScore = Number(b?.score || 0) - Number(a?.score || 0);
      if (byScore !== 0) return byScore;
      return (typePriority[b?.type] || 0) - (typePriority[a?.type] || 0);
    })
  )
    .slice(0, MAX_ITEMS)
    .map(({ score, ...item }) => item);

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
