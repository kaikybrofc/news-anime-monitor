import Link from "next/link";
import Image from "next/image";
import { notFound as renderNotFound, permanentRedirect } from "next/navigation";
import { SafeImage } from "@/components/safe-image";
import { ArticleVisitTracker } from "@/components/article-visit-tracker";
import { fetchMonitor } from "@/lib/api";
import { getArticleLifecycleBadges } from "@/lib/article-state";
import {
  extractArticleIdFromNewsParam,
  formatDateTime,
  formatNumber,
  getArticleDetailPath,
  getArticleImageUrl,
  getArticleTitle,
  getArticleUrl,
  isLikelyArticleId,
  summarizeText,
  summarizeSeoText,
  sanitizeSeoText,
} from "@/lib/formatters";
import { toAbsoluteSiteUrl } from "@/lib/site-url";
import {
  getArticleEntitiesByType,
  getSeoEntityConfigByType,
} from "@/lib/seo-entities";

export const dynamic = "force-dynamic";

function renderInlineMarkdown(text = "") {
  const source = String(text || "");
  if (!source) return source;

  const parts = [];
  const pattern = /\*\*(.+?)\*\*|\*(.+?)\*/g;
  let cursor = 0;
  let match;
  let index = 0;

  while ((match = pattern.exec(source)) !== null) {
    const start = match.index;
    const end = pattern.lastIndex;

    if (start > cursor) {
      parts.push(
        <span key={`md-text-${index}`}>{source.slice(cursor, start)}</span>
      );
      index += 1;
    }

    if (match[1]) {
      parts.push(<strong key={`md-bold-${index}`}>{match[1]}</strong>);
      index += 1;
    } else if (match[2]) {
      parts.push(<em key={`md-italic-${index}`}>{match[2]}</em>);
      index += 1;
    }

    cursor = end;
  }

  if (cursor < source.length) {
    parts.push(<span key={`md-tail-${index}`}>{source.slice(cursor)}</span>);
  }

  return parts.length ? parts : source;
}

function renderMarkdownSummary(summary = "") {
  const text = String(summary || "").trim();
  if (!text) return null;

  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const hasList = lines.some((line) => /^[-*]\s+/.test(line));

  if (!hasList) {
    const paragraphs = text
      .split(/\n{2,}/)
      .map((paragraph) => paragraph.replace(/\n+/g, " ").trim())
      .filter(Boolean);

    return (
      <div className="space-y-4">
        {paragraphs.map((paragraph, index) => (
          <p key={`md-paragraph-${index}`}>
            {renderInlineMarkdown(paragraph)}
          </p>
        ))}
      </div>
    );
  }

  const items = lines
    .filter((line) => /^[-*]\s+/.test(line))
    .map((line) => line.replace(/^[-*]\s+/, "").trim())
    .filter(Boolean);

  if (!items.length) {
    return <p>{renderInlineMarkdown(text.replace(/\n+/g, " "))}</p>;
  }

  return (
    <ul className="list-disc pl-6 space-y-2">
      {items.map((item, index) => (
        <li key={`md-li-${index}`}>{renderInlineMarkdown(item)}</li>
      ))}
    </ul>
  );
}

function dedupeSuggestions(items = [], currentId = "") {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const id = String(item?.id || "").trim();
    const path = getArticleDetailPath(item);
    const key = id || path;
    if (!key || seen.has(key) || id === String(currentId || "")) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function isRankingArticle(title = "", summary = "") {
  const text = `${String(title || "")} ${String(summary || "")}`.toLowerCase();
  return (
    /\btop\s*\d+\b/.test(text) ||
    /\branking\b/.test(text) ||
    /\bmais bem avaliados\b/.test(text) ||
    /\bmelhores\b/.test(text) ||
    /\blista\b/.test(text)
  );
}

function buildRankingRows({
  title = "",
  entitySections = [],
  suggestedNews = [],
  max = 50,
}) {
  const rows = [];
  const seen = new Set();

  for (const section of entitySections) {
    for (const item of section.items || []) {
      const name = String(item?.name || "").trim();
      const key = name.toLowerCase();
      if (!name || seen.has(key)) continue;
      seen.add(key);
      rows.push({ name, source: `Entidade (${section.label})` });
      if (rows.length >= max) return rows;
    }
  }

  for (const item of suggestedNews) {
    const name = String(getArticleTitle(item) || "").trim();
    const key = name.toLowerCase();
    if (!name || seen.has(key)) continue;
    seen.add(key);
    rows.push({ name, source: "Notícia relacionada" });
    if (rows.length >= max) return rows;
  }

  const baseTitle = String(title || "").replace(/\b(os|as|de|do|da|dos|das|mais|bem|avaliados|melhores)\b/gi, " ");
  const tokens = baseTitle
    .split(/[^a-zA-Z0-9À-ÿ]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3);

  for (const token of tokens) {
    const key = token.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({ name: token.charAt(0).toUpperCase() + token.slice(1), source: "Tema do ranking" });
    if (rows.length >= max) break;
  }

  return rows;
}

function extractYear(text = "") {
  const match = String(text || "").match(/\b(19|20)\d{2}\b/);
  return match ? match[0] : "";
}

function extractMonthYear(text = "") {
  const match = String(text || "").match(
    /\b(janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s+de\s+((?:19|20)\d{2})\b/i
  );
  return match ? `${match[1]} de ${match[2]}` : "";
}

function buildClickableMetaDescription({ title = "", summary = "", publishedAt = "" }) {
  const cleanSummary = sanitizeSeoText(summary);
  const cleanTitle = sanitizeSeoText(title);
  const year = extractYear(cleanSummary) || String(new Date(publishedAt || Date.now()).getUTCFullYear());
  const monthYear = extractMonthYear(cleanSummary);
  const timeHint = monthYear || year;

  if (!cleanSummary) {
    return `Entenda o que mudou em ${cleanTitle} e por que essa notícia importa para fãs de anime em ${timeHint}.`;
  }

  const lead = summarizeSeoText(cleanSummary, 120);
  return summarizeSeoText(
    `${lead} Veja os dados-chave, a linha do tempo e o impacto para fãs em ${timeHint}.`,
    160
  );
}

function buildFactBlocks({ title = "", summary = "", sourceName = "", publishedAt = "", score = "" }) {
  const cleanSummary = sanitizeSeoText(summary);
  const monthYear = extractMonthYear(cleanSummary);
  const year = extractYear(cleanSummary);
  const publishLabel = formatDateTime(publishedAt);
  const firstSentence =
    cleanSummary.split(/(?<=[.!?])\s+/).find((chunk) => String(chunk || "").trim().length >= 40) ||
    cleanSummary;

  return {
    keyFacts: [
      `Tema central: ${title || "Atualização do cenário de anime"}.`,
      `Fonte monitorada: ${sourceName || "Fonte editorial"}.`,
      `Publicação acompanhada em: ${publishLabel}.`,
      score ? `Score de relevância no radar: ${score}.` : "",
    ].filter(Boolean),
    timeline: [
      monthYear ? `Período citado no conteúdo: ${monthYear}.` : "",
      year ? `Referências temporais apontam eventos em ${year}.` : "",
      `A notícia entrou no monitor em ${publishLabel}, com atualização contínua de contexto.`,
    ].filter(Boolean),
    fanImpact: [
      firstSentence || "A atualização reforça interesse da comunidade.",
      "Para fãs, o impacto está em acompanhar lançamentos, anúncios e mudanças de calendário com antecedência.",
      "Para quem busca contexto rápido, os blocos desta página priorizam leitura escaneável e decisões de watchlist.",
    ].filter(Boolean),
  };
}

async function loadArticleById(articleId = "") {
  const parsedId = String(articleId || "").trim();
  if (!parsedId) return null;
  const payload = await fetchMonitor(`/articles/${encodeURIComponent(parsedId)}`);
  return payload?.item || null;
}

async function loadArticleBySlug(newsSlug = "") {
  const parsedSlug = String(newsSlug || "").trim();
  if (!parsedSlug) return null;
  const payload = await fetchMonitor(`/articles/slug/${encodeURIComponent(parsedSlug)}`);
  return payload?.item || null;
}

async function resolveArticleByNewsParam(rawParam = "") {
  const raw = String(rawParam || "").trim();
  if (!raw) {
    return { status: "not_found", item: null, articleId: "", errorMessage: "" };
  }

  const hasLegacyMarker = raw.includes("--");
  const legacyExtractedId = hasLegacyMarker ? extractArticleIdFromNewsParam(raw) : "";

  if (hasLegacyMarker && isLikelyArticleId(legacyExtractedId)) {
    try {
      const item = await loadArticleById(legacyExtractedId);
      return { status: item ? "ready" : "not_found", item, articleId: legacyExtractedId, errorMessage: "" };
    } catch (error) {
      if (error?.status !== 404) return { status: "error", item: null, articleId: legacyExtractedId, errorMessage: error.message };
    }
  }

  if (isLikelyArticleId(raw)) {
    try {
      const item = await loadArticleById(raw);
      return { status: item ? "ready" : "not_found", item, articleId: raw, errorMessage: "" };
    } catch (error) {
      if (error?.status !== 404) return { status: "error", item: null, articleId: raw, errorMessage: error.message };
    }
  }

  try {
    const item = await loadArticleBySlug(raw);
    return { status: item ? "ready" : "not_found", item, articleId: String(item?.id || ""), errorMessage: "" };
  } catch (error) {
    if (error?.status === 404) return { status: "not_found", item: null, articleId: legacyExtractedId || raw, errorMessage: "" };
    return { status: "error", item: null, articleId: legacyExtractedId || raw, errorMessage: error.message };
  }
}

export async function generateMetadata(props) {
  const resolvedProps = await props;
  const resolvedParams = await resolvedProps?.params;
  const rawArticleParam = String(resolvedParams?.id || "").trim();
  const resolved = await resolveArticleByNewsParam(rawArticleParam);

  if (resolved.status !== "ready" || !resolved.item) {
    return {
      title: "Notícia | Anime Radar",
      robots: {
        index: false,
        follow: true,
      },
    };
  }

  const article = resolved.item;
  const title = getArticleTitle(article);
  const description = buildClickableMetaDescription({
    title,
    summary: article?.refined?.summary || "",
    publishedAt: article?.refined?.publishedAt || article?.publishedAt || article?.timestamp,
  });
  const canonicalPath = getArticleDetailPath(article);
  const imageUrl = getArticleImageUrl(article);

  return {
    title: `${title} | Anime Radar`,
    description: description || "Detalhe de notícia no Anime Radar.",
    alternates: canonicalPath.startsWith("/noticias/") ? { canonical: canonicalPath } : undefined,
    openGraph: {
      type: "article",
      title,
      description: description || "Notícia no Anime Radar.",
      url: canonicalPath,
      images: imageUrl ? [{ url: imageUrl }] : undefined,
    },
    twitter: {
      card: imageUrl ? "summary_large_image" : "summary",
      title,
      description: description || "Notícia no Anime Radar.",
      images: imageUrl ? [imageUrl] : undefined,
    },
  };
}

export default async function NoticiaDetailPage(props) {
  const resolvedProps = await props;
  const resolvedParams = await resolvedProps?.params;
  const rawArticleParam = String(resolvedParams?.id || "").trim();
  const resolved = await resolveArticleByNewsParam(rawArticleParam);

  const state = {
    status: resolved.status,
    articleId: resolved.articleId || rawArticleParam,
    item: resolved.item || null,
    errorMessage: resolved.errorMessage || "",
  };

  if (state.status === "not_found") {
    renderNotFound();
  }

  if (state.status === "error") {
    return (
      <div className="page-shell">
        <Link href="/noticias" className="inline-link">← Voltar para notícias</Link>
        <article className="info-card warning-card !p-8">
          <h1 className="!text-2xl mb-4">Falha ao carregar notícia</h1>
          <p>Não foi possível carregar este artigo agora. Tente novamente em instantes.</p>
          {process.env.NODE_ENV !== "production" && state.errorMessage ? (
            <p className="technical-note mt-3">{state.errorMessage}</p>
          ) : null}
        </article>
      </div>
    );
  }

  const article = state.item || {};
  const refined = article?.refined || {};
  const title = getArticleTitle(article);
  const sourceUrl = getArticleUrl(article);
  const sourceName = String(refined.sourceName || refined.sourceId || "fonte desconhecida");
  const imageUrl = getArticleImageUrl(article);
  const summary = String(refined.summary || "").trim();
  const summaryForSeo = sanitizeSeoText(summary);
  const publishedAt = refined.publishedAt || article.publishedAt || article.timestamp;
  const lastSeenAt = refined.lastSeenAt || article.timestamp;
  const badges = getArticleLifecycleBadges(article);
  const score = formatNumber(refined.score || 0);
  const canonicalPath = getArticleDetailPath(article);
  const canonicalUrl = toAbsoluteSiteUrl(canonicalPath);
  const factBlocks = buildFactBlocks({
    title,
    summary,
    sourceName,
    publishedAt,
    score,
  });
  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: title,
    datePublished: publishedAt || undefined,
    dateModified: lastSeenAt || publishedAt || undefined,
    image: imageUrl ? [imageUrl] : undefined,
    mainEntityOfPage: canonicalUrl,
    url: canonicalUrl,
    author: {
      "@type": "Organization",
      name: "Anime Radar",
    },
    publisher: {
      "@type": "Organization",
      name: "Anime Radar",
      logo: {
        "@type": "ImageObject",
        url: toAbsoluteSiteUrl("/brand/logo-64.png"),
      },
    },
    description: summaryForSeo || undefined,
    isBasedOn: sourceUrl || undefined,
    articleSection: refined.contentType || "news",
    isAccessibleForFree: true,
    inLanguage: "pt-BR",
  };
  const entitySections = [
    { type: "anime", label: "Anime" },
    { type: "character", label: "Personagem" },
    { type: "studio", label: "Estúdio" },
    { type: "tag", label: "Tag" },
  ]
    .map((section) => {
      const config = getSeoEntityConfigByType(section.type);
      return {
        ...section,
        config,
        items: getArticleEntitiesByType(article, section.type).slice(0, 8),
      };
    })
    .filter((section) => section.config && section.items.length);
  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: toAbsoluteSiteUrl("/"),
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Notícias",
        item: toAbsoluteSiteUrl("/noticias"),
      },
      {
        "@type": "ListItem",
        position: 3,
        name: title,
        item: canonicalUrl,
      },
    ],
  };
  let suggestedNews = [];
  try {
    const sourceId = String(refined.sourceId || "").trim();
    const topTag = String(
      getArticleEntitiesByType(article, "tag")?.[0]?.slug || ""
    ).trim();

    const merged = [];
    if (sourceId) {
      const suggestionsPayload = await fetchMonitor("/articles", {
        source: sourceId,
        limit: 6,
        offset: 0,
      });
      merged.push(...(suggestionsPayload?.items || []));
    }
    if (topTag) {
      const tagPayload = await fetchMonitor("/articles", {
        q: topTag,
        limit: 6,
        offset: 0,
      });
      merged.push(...(tagPayload?.items || []));
    }
    suggestedNews = dedupeSuggestions(merged, article?.id).slice(0, 5);
  } catch {
    suggestedNews = [];
  }
  const rankingTemplateEnabled = isRankingArticle(title, summary);
  const rankingRows = rankingTemplateEnabled
    ? buildRankingRows({ title, entitySections, suggestedNews, max: 50 })
    : [];
  const topHighlights = rankingRows.slice(0, 10);

  if (rawArticleParam && canonicalPath.startsWith("/noticias/") && `/noticias/${rawArticleParam}` !== canonicalPath) {
    permanentRedirect(canonicalPath);
  }

  return (
    <div className="page-shell">
      <ArticleVisitTracker articleId={String(article?.id || "")} articleSlug={rawArticleParam} />
      <script type="application/ld+json" suppressHydrationWarning>
        {JSON.stringify(articleSchema)}
      </script>
      <script type="application/ld+json" suppressHydrationWarning>
        {JSON.stringify(breadcrumbSchema)}
      </script>

      <div className="md:hidden">
        <Link href="/noticias" className="btn btn-secondary !py-2 !px-4 !text-xs w-fit">
          ← Voltar
        </Link>
      </div>

      <section className="grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,1.6fr)_minmax(280px,0.8fr)] xl:items-start animate-fade-in-up delay-100">
        <div className="flex flex-col gap-8">
          {imageUrl ? (
            <article className="info-card !p-0 overflow-hidden">
              <div className="relative aspect-video w-full overflow-hidden">
                <SafeImage
                  src={imageUrl}
                  alt={title || "Imagem de destaque da notícia"}
                  fill
                  sizes="(max-width: 768px) 100vw, (max-width: 1280px) 66vw, 800px"
                  className="h-full w-full object-cover"
                  priority
                  fallbackClassName="h-full w-full"
                />
              </div>
            </article>
          ) : null}

          <article className="editorial-reading-panel">
            <div className="section-heading">
              <span className="page-kicker">Leitura principal</span>
              <h2 className="!text-[1.5rem] md:!text-[2rem] flex items-center gap-3">
                <span className="editorial-inline-accent" aria-hidden />
                Resumo da notícia
              </h2>
            </div>
            {summary ? (
              <div className="editorial-reading-copy">{renderMarkdownSummary(summary)}</div>
            ) : (
              <p className="muted italic">Resumo indisponível para este artigo.</p>
            )}

            <div className="editorial-reading-section">
              <h2 className="!text-[1.25rem] md:!text-[1.5rem]">Contexto e impacto da notícia</h2>
              <p>
                Esta cobertura integra nosso monitor contínuo de{" "}
                <Link href="/noticias" className="inline-link">
                  notícias de anime
                </Link>{" "}
                com foco em lançamentos, franquias e temas em alta. Para ampliar a leitura,
                acesse também as{" "}
                <Link href="/tendencias" className="inline-link">
                  tendências do mercado otaku
                </Link>{" "}
                e os hubs de{" "}
                <Link href="/anime" className="inline-link">
                  animes mais buscados
                </Link>
                .
              </p>
            </div>

            <div className="panel-grid">
              <article className="list-panel">
                <div className="section-heading mb-3">
                  <span className="page-kicker">Leitura rápida</span>
                  <h2>Dados-chave</h2>
                </div>
                <ul className="list-disc pl-6 space-y-2">
                  {factBlocks.keyFacts.map((item, index) => (
                    <li key={`fact-key-${index}`}>{item}</li>
                  ))}
                </ul>
              </article>

              <article className="list-panel">
                <div className="section-heading mb-3">
                  <span className="page-kicker">Linha editorial</span>
                  <h2>Linha do tempo</h2>
                </div>
                <ul className="list-disc pl-6 space-y-2">
                  {factBlocks.timeline.map((item, index) => (
                    <li key={`fact-time-${index}`}>{item}</li>
                  ))}
                </ul>
              </article>
            </div>

            <div className="editorial-reading-section">
              <h2 className="!text-[1.25rem] md:!text-[1.5rem]">O que muda para fãs</h2>
              <ul className="list-disc pl-6 space-y-2">
                {factBlocks.fanImpact.map((item, index) => (
                  <li key={`fact-fans-${index}`}>{item}</li>
                ))}
              </ul>
            </div>

            <div className="editorial-reading-section">
              <h2 className="!text-[1.25rem] md:!text-[1.5rem]">Termos relacionados para busca</h2>
              <p>
                Este conteúdo também atende buscas como <strong>ranking de animes 2026</strong>,{" "}
                <strong>melhores animes do MyAnimeList</strong> e <strong>top animes populares</strong>,
                conectando esta notícia a outros conteúdos relevantes dentro do Anime Radar.
              </p>
            </div>

            {entitySections.length > 0 && (
              <div className="editorial-reading-section">
                <h3 className="page-kicker">Entidades relacionadas</h3>
                <div className="badge-row">
                  {entitySections.map((section) =>
                    section.items.map((item) => (
                      <Link
                        key={`${section.type}:${item.slug}`}
                        href={`${section.config.routeBase}/${item.slug}`}
                        className="entity-pill"
                      >
                        {section.label}: {item.name}
                      </Link>
                    ))
                  )}
                </div>
              </div>
            )}

            {rankingTemplateEnabled && (
              <div className="flex flex-col gap-5">
                <div className="editorial-reading-section">
                  <h2 className="!text-[1.25rem] md:!text-[1.5rem]">Top 10 destaques do ranking</h2>
                  <p>
                    Recorte rápido para quem busca <strong>ranking de animes 2026</strong>,{" "}
                    <strong>melhores animes no MyAnimeList</strong> e termos similares.
                  </p>
                  {topHighlights.length ? (
                    <ol className="list-decimal pl-6 space-y-2">
                      {topHighlights.map((row, index) => (
                        <li key={`rank-top-${index}`}>{row.name}</li>
                      ))}
                    </ol>
                  ) : (
                    <p className="muted">Sem dados suficientes para gerar o top 10.</p>
                  )}
                </div>

                <div className="editorial-reading-section">
                  <h2 className="!text-[1.25rem] md:!text-[1.5rem]">Lista completa do ranking</h2>
                  <p>
                    Estrutura editorial para leitura escaneável. Esta lista é atualizada de forma contínua
                    conforme novas menções e sinais de relevância entram no monitor.
                  </p>
                  {rankingRows.length ? (
                    <div className="ranking-grid">
                      {rankingRows.map((row, index) => (
                        <div key={`rank-row-${index}`} className="ranking-row">
                          <span className="ranking-index">{index + 1}.</span>{" "}
                          <span>{row.name}</span>
                          <span className="ranking-source">({row.source})</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="muted">Sem dados suficientes para montar a lista completa.</p>
                  )}
                </div>
              </div>
            )}

            <div className="article-footer-actions pt-6">
              {sourceUrl ? (
                <a href={sourceUrl} target="_blank" rel="noreferrer" className="btn btn-primary !px-8">
                  Ler fonte original
                </a>
              ) : null}
              <Link href="/noticias" className="btn btn-secondary !px-8 hidden md:inline-flex">
                Voltar para lista
              </Link>
            </div>
          </article>
        </div>

        <aside className="flex flex-col gap-6 xl:sticky xl:top-24">
          <article className="info-card flex flex-col gap-8">
            <div className="section-heading">
              <span className="page-kicker">Inteligência Radar</span>
              <h2>Leitura operacional</h2>
            </div>

            <div className="info-card !p-6 text-center">
              <span className="data-card-label">Score de relevância</span>
              <p className="kpi-number">{score}</p>
            </div>

            <div className="mini-stat-grid">
              <div className="mini-stat-card">
                <span className="mini-stat-label">Visto em</span>
                <span className="mini-stat-value">{formatDateTime(lastSeenAt)}</span>
              </div>
              <div className="mini-stat-card">
                <span className="mini-stat-label">Categoria</span>
                <span className="mini-stat-value">{refined.bucket || "Geral"}</span>
              </div>
              <div className="mini-stat-card mini-stat-card-wide">
                <span className="mini-stat-label">Tipo de conteúdo</span>
                <span className="mini-stat-value">{refined.contentType || "Notícia"}</span>
              </div>
            </div>

            <div className="editorial-callout">
              <p>
                Curadoria do Anime Radar com apoio de automação para acelerar cobertura, organizar entidades e destacar temas de maior relevância.
              </p>
            </div>
          </article>

          <article className="info-card flex flex-col gap-2">
            <div className="section-heading">
              <span className="page-kicker">Continuidade</span>
              <h2>Sugestões para você</h2>
            </div>
            <p className="text-xs">Mais notícias da mesma fonte para continuar a leitura.</p>
            <div className="suggestion-stack">
              {suggestedNews.length ? (
                suggestedNews.map((item) => {
                  const suggestedTitle = getArticleTitle(item);
                  const suggestedPath = getArticleDetailPath(item);
                  const suggestedSummary = summarizeText(item?.refined?.summary || "", 90);
                  const suggestedImage = getArticleImageUrl(item);
                  return (
                    <Link
                      key={String(item?.id || suggestedPath)}
                      href={suggestedPath}
                      className="suggestion-card"
                    >
                      <div className="suggestion-layout">
                        {suggestedImage ? (
                          <div className="suggestion-thumb">
                            <Image
                              src={suggestedImage}
                              alt={suggestedTitle}
                              width={80}
                              height={56}
                              sizes="80px"
                              className="h-full w-full object-cover"
                            />
                          </div>
                        ) : (
                          <div className="suggestion-thumb suggestion-thumb--fallback">
                            <Image
                              src="/brand/logo-64.png"
                              alt="Logo Anime Radar"
                              fill
                              sizes="80px"
                              className="object-cover opacity-35"
                            />
                          </div>
                        )}
                        <div className="suggestion-copy">
                          <p className="suggestion-title">{renderInlineMarkdown(suggestedTitle)}</p>
                          {suggestedSummary ? (
                            <p className="suggestion-summary">{renderInlineMarkdown(suggestedSummary)}</p>
                          ) : null}
                        </div>
                      </div>
                    </Link>
                  );
                })
              ) : (
                <p className="muted text-xs">Sem sugestões no momento.</p>
              )}
            </div>
          </article>

          <Link href="/noticias" className="btn btn-secondary w-full md:hidden">
            Voltar para lista
          </Link>
        </aside>
      </section>
    </div>
  );
}
