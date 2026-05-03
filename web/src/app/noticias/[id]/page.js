import Link from "next/link";
import { notFound as renderNotFound, permanentRedirect } from "next/navigation";
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
      <div className="site-container py-12">
        <Link href="/noticias" className="inline-link mb-6 inline-block">← Voltar para notícias</Link>
        <article className="info-card warning-card p-8">
          <h1 className="text-2xl mb-4">Falha ao carregar notícia</h1>
          <p className="text-slate-400">
            Não foi possível carregar este artigo agora. Tente novamente em instantes.
          </p>
          {process.env.NODE_ENV !== "production" && state.errorMessage ? (
            <p className="text-xs text-slate-500 mt-3">{state.errorMessage}</p>
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
    <div className="flex flex-col gap-6 md:gap-10">
      <script type="application/ld+json" suppressHydrationWarning>
        {JSON.stringify(articleSchema)}
      </script>
      <script type="application/ld+json" suppressHydrationWarning>
        {JSON.stringify(breadcrumbSchema)}
      </script>

      {/* Mobile Back Button */}
      <div className="md:hidden">
        <Link href="/noticias" className="btn btn-secondary !py-2 !px-4 !text-xs w-fit">
          ← Voltar
        </Link>
      </div>

      {/* Hero Section */}
      <section className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-12">
        <div className="flex flex-col gap-6 lg:w-2/3">
          <header className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs font-black uppercase tracking-widest text-rose-500">{sourceName}</span>
              <div className="h-1 w-1 rounded-full bg-slate-700" />
              <span className="text-xs font-medium text-slate-400">{formatDateTime(publishedAt)}</span>
            </div>
            <h1 className="!text-3xl md:!text-5xl !leading-[1.15]">{title}</h1>
            {badges.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-2">
                {badges.map((badge) => (
                  <span key={badge.key} className={`status-badge !text-[10px] ${badge.toneClass}`}>
                    {badge.label}
                  </span>
                ))}
              </div>
            )}
          </header>

          {imageUrl && (
            <div className="relative aspect-video w-full overflow-hidden rounded-3xl border border-slate-800 shadow-2xl">
              <img
                src={imageUrl}
                alt={title || "Imagem de destaque da notícia"}
                className="h-full w-full object-cover"
                fetchPriority="high"
              />
            </div>
          )}

          <div className="flex flex-col gap-6 bg-slate-900/50 p-6 md:p-10 rounded-3xl border border-slate-800">
            <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
              <span className="h-5 w-1 bg-rose-500 rounded-full" />
              Resumo da Notícia
            </h2>
            {summary ? (
              <div className="text-base md:text-lg text-slate-300 leading-relaxed">
                {renderMarkdownSummary(summary)}
              </div>
            ) : (
              <p className="text-slate-500 italic italic">Resumo indisponível para este artigo.</p>
            )}

            <div className="flex flex-col gap-3">
              <h2 className="text-lg font-bold text-slate-100">
                Contexto e impacto da notícia
              </h2>
              <p className="text-slate-300">
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

            <div className="flex flex-col gap-3">
              <h2 className="text-lg font-bold text-slate-100">Dados-chave</h2>
              <ul className="list-disc pl-6 space-y-1 text-slate-300">
                {factBlocks.keyFacts.map((item, index) => (
                  <li key={`fact-key-${index}`}>{item}</li>
                ))}
              </ul>
            </div>

            <div className="flex flex-col gap-3">
              <h2 className="text-lg font-bold text-slate-100">Linha do tempo</h2>
              <ul className="list-disc pl-6 space-y-1 text-slate-300">
                {factBlocks.timeline.map((item, index) => (
                  <li key={`fact-time-${index}`}>{item}</li>
                ))}
              </ul>
            </div>

            <div className="flex flex-col gap-3">
              <h2 className="text-lg font-bold text-slate-100">O que muda para fãs</h2>
              <ul className="list-disc pl-6 space-y-1 text-slate-300">
                {factBlocks.fanImpact.map((item, index) => (
                  <li key={`fact-fans-${index}`}>{item}</li>
                ))}
              </ul>
            </div>

            <div className="flex flex-col gap-3">
              <h2 className="text-lg font-bold text-slate-100">
                Termos relacionados para busca
              </h2>
              <p className="text-slate-300">
                Este conteúdo também atende buscas como <strong>ranking de animes 2026</strong>,{" "}
                <strong>melhores animes do MyAnimeList</strong> e <strong>top animes populares</strong>,
                conectando esta notícia a outros conteúdos relevantes dentro do Anime Radar.
              </p>
            </div>

            {entitySections.length > 0 && (
              <div className="flex flex-col gap-3">
                <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400">
                  Entidades relacionadas
                </h3>
                <div className="flex flex-wrap gap-2">
                  {entitySections.map((section) =>
                    section.items.map((item) => (
                      <Link
                        key={`${section.type}:${item.slug}`}
                        href={`${section.config.routeBase}/${item.slug}`}
                        className="status-badge border border-slate-700 bg-slate-800/80 text-slate-200 normal-case tracking-normal"
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
                <div className="flex flex-col gap-3">
                  <h2 className="text-lg font-bold text-slate-100">
                    Top 10 destaques do ranking
                  </h2>
                  <p className="text-slate-300">
                    Recorte rápido para quem busca <strong>ranking de animes 2026</strong>,{" "}
                    <strong>melhores animes no MyAnimeList</strong> e termos similares.
                  </p>
                  {topHighlights.length ? (
                    <ol className="list-decimal pl-6 space-y-1 text-slate-200">
                      {topHighlights.map((row, index) => (
                        <li key={`rank-top-${index}`}>
                          <span>{row.name}</span>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="text-slate-500">Sem dados suficientes para gerar o top 10.</p>
                  )}
                </div>

                <div className="flex flex-col gap-3">
                  <h2 className="text-lg font-bold text-slate-100">
                    Lista completa do ranking (até 50 itens)
                  </h2>
                  <p className="text-slate-300">
                    Estrutura editorial para leitura escaneável. Esta lista é atualizada de forma contínua
                    conforme novas menções e sinais de relevância entram no monitor.
                  </p>
                  {rankingRows.length ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {rankingRows.map((row, index) => (
                        <div
                          key={`rank-row-${index}`}
                          className="rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm text-slate-200"
                        >
                          <span className="font-semibold text-rose-300">{index + 1}.</span>{" "}
                          <span>{row.name}</span>
                          <span className="ml-2 text-[11px] text-slate-500">({row.source})</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-slate-500">Sem dados suficientes para montar a lista completa.</p>
                  )}
                </div>
              </div>
            )}
            
            <div className="pt-6 border-t border-slate-800 flex flex-wrap gap-4">
              {sourceUrl && (
                <a href={sourceUrl} target="_blank" rel="noreferrer" className="btn btn-primary !px-8">
                  Ler Fonte Original
                </a>
              )}
              <Link href="/noticias" className="btn btn-secondary !px-8 hidden md:inline-flex">
                Voltar para Lista
              </Link>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <aside className="flex flex-col gap-6 lg:w-1/3 lg:sticky lg:top-24">
          <div className="info-card flex flex-col gap-8">
            <div className="flex flex-col gap-3">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Inteligência Radar</span>
              <div className="bg-slate-950/50 p-6 rounded-2xl border border-slate-800 flex flex-col gap-1 items-center justify-center text-center">
                <span className="text-xs font-bold text-slate-500 uppercase">Score de Relevância</span>
                <span className="text-5xl font-black text-rose-500 tracking-tighter">{score}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1 p-3 bg-slate-900/30 rounded-xl border border-slate-800/50">
                <span className="text-[9px] font-bold text-slate-500 uppercase">Visto em</span>
                <span className="text-xs font-semibold text-slate-200">{formatDateTime(lastSeenAt)}</span>
              </div>
              <div className="flex flex-col gap-1 p-3 bg-slate-900/30 rounded-xl border border-slate-800/50">
                <span className="text-[9px] font-bold text-slate-500 uppercase">Categoria</span>
                <span className="text-xs font-semibold text-slate-200 capitalize">{refined.bucket || "Geral"}</span>
              </div>
              <div className="flex flex-col gap-1 p-3 bg-slate-900/30 rounded-xl border border-slate-800/50 col-span-2">
                <span className="text-[9px] font-bold text-slate-500 uppercase">Tipo de Conteúdo</span>
                <span className="text-xs font-semibold text-slate-200 capitalize">{refined.contentType || "Notícia"}</span>
              </div>
            </div>

            <div className="p-4 bg-rose-500/5 border border-rose-500/10 rounded-2xl">
              <p className="text-[11px] text-rose-400 leading-relaxed font-medium">
                Curadoria do Anime Radar com apoio de automação para acelerar cobertura, organizar entidades e destacar temas de maior relevância.
              </p>
            </div>
          </div>

          <div className="info-card border-sky-500/20 bg-sky-500/5">
            <h3 className="text-xs font-black uppercase tracking-[0.18em] text-sky-300">
              Sugestões para você
            </h3>
            <p className="mt-2 text-xs text-slate-400">
              Mais notícias da mesma fonte para continuar a leitura.
            </p>
            <div className="mt-4 flex flex-col gap-3">
              {suggestedNews.length ? (
                suggestedNews.map((item) => {
                  const suggestedTitle = getArticleTitle(item);
                  const suggestedPath = getArticleDetailPath(item);
                  const suggestedSummary = summarizeText(
                    item?.refined?.summary || "",
                    90
                  );
                  const suggestedImage = getArticleImageUrl(item);
                  return (
                    <Link
                      key={String(item?.id || suggestedPath)}
                      href={suggestedPath}
                      className="rounded-xl border border-slate-700 bg-slate-900/50 p-3 transition hover:border-sky-400/40 hover:bg-slate-900"
                    >
                      <div className="flex gap-3">
                        {suggestedImage ? (
                          <div className="h-14 w-20 shrink-0 overflow-hidden rounded-lg border border-slate-700">
                            <img
                              src={suggestedImage}
                              alt={suggestedTitle}
                              className="h-full w-full object-cover"
                              loading="lazy"
                            />
                          </div>
                        ) : (
                          <div className="h-14 w-20 shrink-0 rounded-lg border border-slate-700 bg-slate-800/70 text-[10px] text-slate-500 flex items-center justify-center">
                            Sem imagem
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-100 line-clamp-2">
                            {renderInlineMarkdown(suggestedTitle)}
                          </p>
                          {suggestedSummary ? (
                            <p className="mt-1 text-xs text-slate-400 line-clamp-2">
                              {renderInlineMarkdown(suggestedSummary)}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </Link>
                  );
                })
              ) : (
                <p className="text-xs text-slate-500">
                  Sem sugestões no momento.
                </p>
              )}
            </div>
          </div>

          <Link href="/noticias" className="btn btn-secondary w-full md:hidden">
            Voltar para Lista
          </Link>
        </aside>
      </section>
    </div>
  );
}
