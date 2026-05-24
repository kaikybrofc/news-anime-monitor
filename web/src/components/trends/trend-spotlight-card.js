import Link from "next/link";
import { SafeImage } from "@/components/safe-image";
import {
  formatDateTime,
  formatNumber,
  getArticleDetailPath,
  getArticleImageUrl,
  getArticleTitle,
  summarizeTextBySentence,
} from "@/lib/formatters";

export function TrendSpotlightCard({ franchise, article }) {
  if (!franchise || !article) return null;

  const imageUrl = getArticleImageUrl(article);
  const articleTitle = getArticleTitle(article);
  const articleHref = getArticleDetailPath(article);
  const articleSummary = summarizeTextBySentence(article?.refined?.summary || "", 220);

  return (
    <article className="info-card trend-spotlight-card animate-fade-in-up delay-100">
      <div className="trend-spotlight-media">
        <Link href={articleHref} className="trend-spotlight-image" title={articleTitle}>
          <SafeImage
            src={imageUrl}
            alt={articleTitle || `Destaque de ${franchise.name}`}
            fill
            sizes="(max-width: 1024px) 100vw, 50vw"
            className="object-cover"
            fallbackClassName="trend-spotlight-image"
          />
        </Link>
      </div>

      <div className="trend-spotlight-body">
        <div className="section-heading">
          <span className="page-kicker">Tendência principal</span>
          <h2>{franchise.name}</h2>
          <p className="section-copy">
            O eixo mais forte do ciclo atual, impulsionado por múltiplas menções, fontes distintas e uma notícia representativa com potencial de engajamento alto.
          </p>
        </div>

        <div className="mini-stat-grid">
          <div className="mini-stat-card">
            <span className="mini-stat-label">Menções</span>
            <span className="mini-stat-value">{formatNumber(franchise.mentions || 0)}</span>
          </div>
          <div className="mini-stat-card">
            <span className="mini-stat-label">Fontes</span>
            <span className="mini-stat-value">{formatNumber(franchise.sourceCount || 0)}</span>
          </div>
          <div className="mini-stat-card mini-stat-card-wide">
            <span className="mini-stat-label">Score médio</span>
            <span className="mini-stat-value">{formatNumber(franchise.avgScore || 0)}</span>
          </div>
        </div>

        <div className="trend-spotlight-copy">
          <span className="trend-badge">Notícia representativa</span>
          <Link href={articleHref} className="article-title-link block">
            <h3>{articleTitle}</h3>
          </Link>
          {articleSummary ? <p>{articleSummary}</p> : null}
          <div className="meta-line">
            <span>Fonte: {article?.refined?.sourceName || article?.refined?.sourceId || "fonte"}</span>
            <span>Publicado: {formatDateTime(article?.refined?.publishedAt || article?.timestamp)}</span>
          </div>
        </div>

        <div className="article-footer-actions !border-t-0 !pt-0">
          <Link href={`/franquias/${franchise.slug}`} className="btn btn-primary !px-6">
            Ver franquia
          </Link>
          <Link href={articleHref} className="btn btn-secondary !px-6">
            Ler notícia
          </Link>
        </div>
      </div>
    </article>
  );
}
