import Link from "next/link";
import { getArticleLifecycleBadges } from "@/lib/article-state";
import {
  formatDateTime,
  formatNumber,
  getArticleImageUrl,
  getArticleTitle,
  getArticleUrl,
  summarizeText,
} from "@/lib/formatters";

function buildTagList(article) {
  const refined = article?.refined || {};
  const tags = [];

  if (refined.bucket) tags.push(`bucket:${refined.bucket}`);
  if (refined.contentType) tags.push(`tipo:${refined.contentType}`);
  if (Number.isFinite(Number(refined.timesSeen))) tags.push(`views:${refined.timesSeen}`);

  return tags;
}

export function ArticleCard({ article }) {
  const refined = article?.refined || {};
  const articleId = String(article?.id || "").trim();
  const title = getArticleTitle(article);
  const url = getArticleUrl(article);
  const imageUrl = getArticleImageUrl(article);
  const summary = summarizeText(refined.summary || "", 120);
  const tags = buildTagList(article);
  const lifecycleBadges = getArticleLifecycleBadges(article);
  const sourceName = String(refined.sourceName || refined.sourceId || "fonte desconhecida");
  const publishedAt = refined.publishedAt || article.publishedAt || article.timestamp;
  const lastSeenAt = refined.lastSeenAt || article.timestamp;
  const score = formatNumber(refined.score || 0);
  const detailHref = articleId ? `/noticias/${articleId}` : "/noticias";

  return (
    <article className="info-card article-card">
      {imageUrl ? (
        <Link href={detailHref} className="article-cover" title="Abrir detalhe da noticia">
          <img src={imageUrl} alt={title} loading="lazy" />
        </Link>
      ) : null}

      <div className="article-header">
        <Link href={detailHref} className="article-title-link" title="Abrir detalhe da noticia">
          <h2>{title}</h2>
        </Link>
      </div>

      <p className="meta-line">
        <span>Fonte: {sourceName}</span>
        <span>Score: {score}</span>
        <span>Publicado: {formatDateTime(publishedAt)}</span>
        <span>Ultimo seen: {formatDateTime(lastSeenAt)}</span>
      </p>

      {lifecycleBadges.length ? (
        <div className="badge-row">
          {lifecycleBadges.map((badge) => (
            <span key={badge.key} className={`status-badge ${badge.toneClass}`}>
              {badge.label}
            </span>
          ))}
        </div>
      ) : null}

      {summary ? <p className="article-summary">{summary}</p> : null}

      <div className="article-actions">
        <Link href={detailHref} className="inline-link">
          Ler detalhe
        </Link>
        {url ? (
          <a href={url} target="_blank" rel="noreferrer" className="inline-link">
            Fonte original
          </a>
        ) : null}
      </div>

      {tags.length ? (
        <div className="inline-tags">
          {tags.map((tag) => (
            <span key={tag} className="tag">
              {tag}
            </span>
          ))}
        </div>
      ) : null}
    </article>
  );
}
