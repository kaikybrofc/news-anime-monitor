import Link from "next/link";
import { SafeImage } from "@/components/safe-image";
import {
  formatDateTime,
  formatNumber,
  getArticleDetailPath,
  getArticleImageUrl,
  getArticleTitle,
  summarizeText,
} from "@/lib/formatters";

export function TrendEntityCard({ eyebrow = "Tendência", title, description, href, metrics = [], article, ctaLabel = "Explorar" }) {
  const articleTitle = article ? getArticleTitle(article) : "";
  const articleHref = article ? getArticleDetailPath(article) : "";
  const articleImage = article ? getArticleImageUrl(article) : "";
  const articleSummary = article ? summarizeText(article?.refined?.summary || "", 140) : "";

  return (
    <article className="info-card trend-entity-card">
      <div className="section-heading">
        <span className="page-kicker">{eyebrow}</span>
        <h3>{title}</h3>
        {description ? <p className="section-copy">{description}</p> : null}
      </div>

      {metrics.length ? (
        <div className="trend-metric-list">
          {metrics.map((metric) => (
            <div key={metric.label} className="trend-metric-pill">
              <span className="trend-metric-label">{metric.label}</span>
              <strong>{formatNumber(metric.value || 0)}</strong>
            </div>
          ))}
        </div>
      ) : null}

      {article ? (
        <Link href={articleHref} className="trend-related-article">
          <div className="trend-related-thumb">
            <SafeImage
              src={articleImage}
              alt={articleTitle || "Notícia relacionada"}
              fill
              sizes="(max-width: 768px) 100vw, 160px"
              className="object-cover"
              fallbackClassName="trend-related-thumb"
            />
          </div>
          <div className="trend-related-copy">
            <strong>{articleTitle}</strong>
            {articleSummary ? <p>{articleSummary}</p> : null}
            <span>
              {article?.refined?.sourceName || article?.refined?.sourceId || "fonte"} • {formatDateTime(article?.refined?.publishedAt || article?.timestamp)}
            </span>
          </div>
        </Link>
      ) : null}

      <div className="article-footer-actions !border-t-0 !pt-0">
        <Link href={href} className="btn btn-secondary !px-6 w-full">
          {ctaLabel}
        </Link>
      </div>
    </article>
  );
}
