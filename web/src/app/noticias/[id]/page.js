import Link from "next/link";
import { permanentRedirect } from "next/navigation";
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
    return {
      status: "not_found",
      item: null,
      articleId: "",
      errorMessage: "",
    };
  }

  const hasLegacyMarker = raw.includes("--");
  const legacyExtractedId = hasLegacyMarker ? extractArticleIdFromNewsParam(raw) : "";

  if (hasLegacyMarker && isLikelyArticleId(legacyExtractedId)) {
    try {
      const item = await loadArticleById(legacyExtractedId);
      return {
        status: item ? "ready" : "not_found",
        item,
        articleId: legacyExtractedId,
        errorMessage: "",
      };
    } catch (error) {
      if (error?.status !== 404) {
        return {
          status: "error",
          item: null,
          articleId: legacyExtractedId,
          errorMessage: error.message,
        };
      }
    }
  }

  if (isLikelyArticleId(raw)) {
    try {
      const item = await loadArticleById(raw);
      return {
        status: item ? "ready" : "not_found",
        item,
        articleId: raw,
        errorMessage: "",
      };
    } catch (error) {
      if (error?.status !== 404) {
        return {
          status: "error",
          item: null,
          articleId: raw,
          errorMessage: error.message,
        };
      }
    }
  }

  try {
    const item = await loadArticleBySlug(raw);
    return {
      status: item ? "ready" : "not_found",
      item,
      articleId: String(item?.id || ""),
      errorMessage: "",
    };
  } catch (error) {
    if (error?.status === 404) {
      return {
        status: "not_found",
        item: null,
        articleId: legacyExtractedId || raw,
        errorMessage: "",
      };
    }

    return {
      status: "error",
      item: null,
      articleId: legacyExtractedId || raw,
      errorMessage: error.message,
    };
  }
}

export async function generateMetadata(props) {
  const resolvedProps = await props;
  const resolvedParams = await resolvedProps?.params;
  const rawArticleParam = String(resolvedParams?.id || "").trim();
  const resolved = await resolveArticleByNewsParam(rawArticleParam);

  if (resolved.status !== "ready" || !resolved.item) {
    return {
      title: "Noticia | OmniZap Anime Radar",
    };
  }

  const article = resolved.item;
  const title = getArticleTitle(article);
  const description = summarizeText(article?.refined?.summary || "", 160);
  const canonicalPath = getArticleDetailPath(article);

  return {
    title: `${title} | OmniZap Anime Radar`,
    description: description || "Detalhe de noticia no OmniZap Anime Radar.",
    alternates: canonicalPath.startsWith("/noticias/")
      ? { canonical: canonicalPath }
      : undefined,
  };
}

function buildNotFoundState(articleId) {
  return {
    status: "not_found",
    articleId,
    item: null,
    errorMessage: "",
  };
}

export default async function NoticiaDetailPage(props) {
  const resolvedProps = await props;
  const resolvedParams = await resolvedProps?.params;
  const rawArticleParam = String(resolvedParams?.id || "").trim();
  const resolved = await resolveArticleByNewsParam(rawArticleParam);
  let state = {
    status: resolved.status,
    articleId: resolved.articleId || rawArticleParam,
    item: resolved.item || null,
    errorMessage: resolved.errorMessage || "",
  };

  if (state.status === "not_found") {
    return (
      <section className="stack">
        <div className="site-container">
          <Link href="/noticias" className="inline-link mb-4 inline-block">
            ← Voltar para noticias
          </Link>
          <article className="info-card warning-card">
            <h1>Noticia nao encontrada</h1>
            <p>O artigo `{state.articleId}` nao foi localizado na base atual.</p>
          </article>
        </div>
      </section>
    );
  }

  if (state.status === "error") {
    return (
      <section className="stack">
        <div className="site-container">
          <Link href="/noticias" className="inline-link mb-4 inline-block">
            ← Voltar para noticias
          </Link>
          <article className="info-card warning-card">
            <h1>Falha ao carregar noticia</h1>
            <p>{state.errorMessage || "Erro inesperado."}</p>
          </article>
        </div>
      </section>
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

  if (rawArticleParam && canonicalPath.startsWith("/noticias/")) {
    const requestedPath = `/noticias/${rawArticleParam}`;
    if (requestedPath !== canonicalPath) {
      permanentRedirect(canonicalPath);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <Link href="/noticias" className="inline-link w-fit">
        ← Voltar para noticias
      </Link>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          <article className="hero-card !p-0 overflow-hidden">
            {imageUrl && (
              <div className="relative aspect-video w-full overflow-hidden border-b border-slate-100">
                <img 
                  src={imageUrl} 
                  alt={title} 
                  className="h-full w-full object-cover"
                />
              </div>
            )}
            
            <div className="p-6 md:p-8 space-y-6">
              <div className="space-y-2">
                <p className="eyebrow">{sourceName}</p>
                <h1 className="!text-3xl md:!text-4xl">{title}</h1>
              </div>

              {badges.length ? (
                <div className="badge-row">
                  {badges.map((badge) => (
                    <span key={badge.key} className={`status-badge ${badge.toneClass}`}>
                      {badge.label}
                    </span>
                  ))}
                </div>
              ) : null}

              <div className="prose prose-slate max-w-none">
                <h2 className="text-xl font-bold mb-4">Resumo do Artigo</h2>
                {summary ? (
                  <p className="article-summary whitespace-pre-line text-base leading-relaxed">
                    {summary}
                  </p>
                ) : (
                  <p className="text-slate-400 italic">Resumo indisponivel para este artigo.</p>
                )}
              </div>

              <div className="pt-6 border-t border-slate-100 flex flex-wrap gap-3">
                {sourceUrl && (
                  <a
                    href={sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-primary"
                  >
                    Ler na Fonte Original
                  </a>
                )}
                <Link href="/noticias" className="btn btn-secondary">
                  Voltar para Lista
                </Link>
              </div>
            </div>
          </article>
        </div>

        {/* Sidebar Info */}
        <aside className="flex flex-col gap-6">
          <div className="info-card">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-6 border-b border-slate-50 pb-2">
              Informações Técnicas
            </h3>
            
            <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-1">
              <div className="flex flex-col gap-1 col-span-2 sm:col-span-1 lg:col-span-2 bg-slate-800/50 p-3 rounded-xl border border-slate-700">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Score de Relevância</span>
                <span className="text-4xl font-black text-rose-500 tracking-tighter">{score}</span>
              </div>
              
              <div className="flex flex-col border-t border-slate-50 pt-3">
                <span className="text-[10px] font-bold uppercase text-slate-400">Publicado</span>
                <span className="text-xs font-semibold text-slate-700">{formatDateTime(publishedAt)}</span>
              </div>

              <div className="flex flex-col border-t border-slate-50 pt-3">
                <span className="text-[10px] font-bold uppercase text-slate-400">Visto</span>
                <span className="text-xs font-semibold text-slate-700">{formatDateTime(lastSeenAt)}</span>
              </div>

              <div className="flex flex-col border-t border-slate-50 pt-3">
                <span className="text-[10px] font-bold uppercase text-slate-400">Categoria</span>
                <span className="text-xs font-semibold text-slate-700 capitalize">{refined.bucket || "Geral"}</span>
              </div>

              <div className="flex flex-col border-t border-slate-50 pt-3">
                <span className="text-[10px] font-bold uppercase text-slate-400">Tipo</span>
                <span className="text-xs font-semibold text-slate-700 capitalize">{refined.contentType || "Notícia"}</span>
              </div>
            </div>
          </div>

          <div className="info-card bg-rose-50 border-rose-100">
            <h3 className="text-sm font-bold text-rose-900 mb-2">Sobre este monitor</h3>
            <p className="text-xs text-rose-700 leading-normal">
              Este artigo foi processado automaticamente pelo OmniZap Anime Radar, 
              analisando relevância e tendências em tempo real.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
