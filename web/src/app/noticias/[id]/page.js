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
} from "@/lib/formatters";
import { toAbsoluteSiteUrl } from "@/lib/site-url";
import {
  getArticleEntitiesByType,
  getSeoEntityConfigByType,
} from "@/lib/seo-entities";

export const dynamic = "force-dynamic";

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
  const description = summarizeText(article?.refined?.summary || "", 160);
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
  const publishedAt = refined.publishedAt || article.publishedAt || article.timestamp;
  const lastSeenAt = refined.lastSeenAt || article.timestamp;
  const badges = getArticleLifecycleBadges(article);
  const score = formatNumber(refined.score || 0);
  const canonicalPath = getArticleDetailPath(article);
  const canonicalUrl = toAbsoluteSiteUrl(canonicalPath);
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
      name: sourceName,
    },
    publisher: {
      "@type": "Organization",
      name: "Anime Radar",
    },
    description: summary || undefined,
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

  if (rawArticleParam && canonicalPath.startsWith("/noticias/") && `/noticias/${rawArticleParam}` !== canonicalPath) {
    permanentRedirect(canonicalPath);
  }

  return (
    <div className="flex flex-col gap-6 md:gap-10">
      <script type="application/ld+json" suppressHydrationWarning>
        {JSON.stringify(articleSchema)}
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
              <img src={imageUrl} alt={title} className="h-full w-full object-cover" />
            </div>
          )}

          <div className="flex flex-col gap-6 bg-slate-900/50 p-6 md:p-10 rounded-3xl border border-slate-800">
            <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
              <span className="h-5 w-1 bg-rose-500 rounded-full" />
              Resumo da Notícia
            </h2>
            {summary ? (
              <p className="text-base md:text-lg text-slate-300 leading-relaxed whitespace-pre-line">
                {summary}
              </p>
            ) : (
              <p className="text-slate-500 italic italic">Resumo indisponível para este artigo.</p>
            )}

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
                Este artigo foi processado e analisado automaticamente pela pipeline de dados do Anime Radar.
              </p>
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
