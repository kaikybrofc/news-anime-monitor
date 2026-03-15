import { formatDateTime, getArticleTitle, getArticleUrl, summarizeText } from "@/lib/formatters";

function buildTagList(article) {
  const refined = article?.refined || {};
  const tags = [];

  if (refined.sourceName || refined.sourceId) {
    tags.push(refined.sourceName || refined.sourceId);
  }
  if (refined.bucket) tags.push(`bucket:${refined.bucket}`);
  if (refined.contentType) tags.push(`tipo:${refined.contentType}`);
  if (refined.lastSeenEvent) tags.push(`evento:${refined.lastSeenEvent}`);
  if (Number.isFinite(Number(refined.score))) tags.push(`score:${refined.score}`);
  if (Number.isFinite(Number(refined.timesSeen))) tags.push(`views:${refined.timesSeen}`);

  return tags;
}

export function ArticleCard({ article }) {
  const refined = article?.refined || {};
  const title = getArticleTitle(article);
  const url = getArticleUrl(article);
  const summary = summarizeText(refined.summary || "");
  const tags = buildTagList(article);
  const publishedAt = refined.publishedAt || article.publishedAt || article.timestamp;
  const lastSeenAt = refined.lastSeenAt || article.timestamp;

  return (
    <article className="info-card article-card">
      <div className="article-header">
        {url ? (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="article-title-link"
            title="Abrir fonte original"
          >
            <h2>{title}</h2>
          </a>
        ) : (
          <h2>{title}</h2>
        )}
      </div>

      <p className="meta-line">
        <span>Publicado: {formatDateTime(publishedAt)}</span>
        <span>Ultimo seen: {formatDateTime(lastSeenAt)}</span>
      </p>

      {summary ? <p className="article-summary">{summary}</p> : null}

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

