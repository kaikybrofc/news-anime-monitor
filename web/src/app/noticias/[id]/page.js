import Link from "next/link";
import { fetchMonitor } from "@/lib/api";
import { getArticleLifecycleBadges } from "@/lib/article-state";
import {
  formatDateTime,
  formatNumber,
  getArticleImageUrl,
  getArticleTitle,
  getArticleUrl,
} from "@/lib/formatters";

export const dynamic = "force-dynamic";

export async function generateMetadata(props) {
  const resolvedProps = await props;
  const resolvedParams = await resolvedProps?.params;
  const articleId = String(resolvedParams?.id || "");
  return {
    title: `Noticia ${articleId} | OmniZap Anime Radar`,
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
  const articleId = String(resolvedParams?.id || "").trim();
  let state = {
    status: "ready",
    articleId,
    item: null,
    errorMessage: "",
  };

  try {
    const payload = await fetchMonitor(`/articles/${encodeURIComponent(articleId)}`);
    state.item = payload?.item || null;
  } catch (error) {
    if (error?.status === 404) {
      state = buildNotFoundState(articleId);
    } else {
      state.status = "error";
      state.errorMessage = error.message;
    }
  }

  if (state.status === "not_found") {
    return (
      <section className="stack">
        <Link href="/noticias" className="inline-link">
          Voltar para noticias
        </Link>
        <article className="info-card warning-card">
          <h1>Noticia nao encontrada</h1>
          <p>O artigo `{state.articleId}` nao foi localizado na base atual.</p>
        </article>
      </section>
    );
  }

  if (state.status === "error") {
    return (
      <section className="stack">
        <Link href="/noticias" className="inline-link">
          Voltar para noticias
        </Link>
        <article className="info-card warning-card">
          <h1>Falha ao carregar noticia</h1>
          <p>{state.errorMessage || "Erro inesperado."}</p>
        </article>
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

  return (
    <section className="stack">
      <Link href="/noticias" className="inline-link">
        Voltar para noticias
      </Link>

      <article className="hero-card detail-hero">
        <p className="eyebrow">News Detail</p>
        <h1>{title}</h1>

        {imageUrl ? (
          <div className="detail-cover">
            <img src={imageUrl} alt={title} loading="lazy" />
          </div>
        ) : null}

        {badges.length ? (
          <div className="badge-row">
            {badges.map((badge) => (
              <span key={badge.key} className={`status-badge ${badge.toneClass}`}>
                {badge.label}
              </span>
            ))}
          </div>
        ) : null}

        <div className="detail-grid">
          <p>
            <strong>Fonte:</strong> {sourceName}
          </p>
          <p>
            <strong>Score:</strong> {formatNumber(refined.score || 0)}
          </p>
          <p>
            <strong>Bucket:</strong> {refined.bucket || "unknown"}
          </p>
          <p>
            <strong>Tipo:</strong> {refined.contentType || "unknown"}
          </p>
          <p>
            <strong>Publicado:</strong> {formatDateTime(publishedAt)}
          </p>
          <p>
            <strong>Ultimo seen:</strong> {formatDateTime(lastSeenAt)}
          </p>
        </div>

        <div className="hero-actions">
          {sourceUrl ? (
            <a
              href={sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="btn btn-primary"
              title="Abrir noticia na fonte original"
            >
              Fonte original
            </a>
          ) : null}
          <Link href="/noticias" className="btn btn-secondary">
            Voltar para lista
          </Link>
        </div>
      </article>

      <article className="info-card">
        <h2>Resumo</h2>
        {summary ? (
          <p className="article-summary whitespace-pre-line">{summary}</p>
        ) : (
          <p className="muted">Resumo indisponivel para este artigo.</p>
        )}
      </article>
    </section>
  );
}
