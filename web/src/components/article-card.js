import Link from "next/link";
import Image from "next/image";
import { getArticleLifecycleBadges } from "@/lib/article-state";
import { SafeImage } from "@/components/safe-image";
import {
  formatDateTime,
  formatNumber,
  getArticleDetailPath,
  getArticleImageUrl,
  getArticleTitle,
  getArticleUrl,
  summarizeText,
} from "@/lib/formatters";

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
      parts.push(<span key={`md-text-${index}`}>{source.slice(cursor, start)}</span>);
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

function renderSummaryMarkdown(summary = "") {
  const text = String(summary || "").trim();
  if (!text) return null;

  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const hasList = lines.some((line) => /^[-*]\s+/.test(line));
  if (!hasList) {
    return renderInlineMarkdown(text.replace(/\n+/g, " "));
  }

  const items = lines
    .filter((line) => /^[-*]\s+/.test(line))
    .map((line) => line.replace(/^[-*]\s+/, "").trim())
    .filter(Boolean);

  if (!items.length) {
    return renderInlineMarkdown(text.replace(/\n+/g, " "));
  }

  return (
    <ul className="list-disc space-y-1 pl-5">
      {items.map((item, index) => (
        <li key={`md-li-${index}`}>{renderInlineMarkdown(item)}</li>
      ))}
    </ul>
  );
}

export function ArticleCard({ article }) {
  const refined = article?.refined || {};
  const title = getArticleTitle(article);
  const url = getArticleUrl(article);
  const imageUrl = getArticleImageUrl(article);
  const rawSummary = String(refined.summary || "").trim();
  const summaryForClamp = summarizeText(rawSummary, 220);
  const lifecycleBadges = getArticleLifecycleBadges(article);
  const sourceName = String(refined.sourceName || refined.sourceId || "fonte desconhecida");
  const publishedAt = refined.publishedAt || article.publishedAt || article.timestamp;
  const score = formatNumber(refined.score || 0);
  const detailHref = getArticleDetailPath(article);

  return (
    <article className="info-card article-card group">
      {imageUrl ? (
        <Link href={detailHref} className="article-cover" title="Abrir detalhes da notícia">
          <SafeImage
            src={imageUrl}
            alt={title || "Imagem de capa da notícia"}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            className="object-cover"
            fallbackClassName="article-cover"
          />
        </Link>
      ) : (
        <Link href={detailHref} className="article-cover" title="Abrir detalhes da notícia">
          <Image
            src="/brand/logo-64.png"
            alt="Logo Anime Radar"
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            className="object-cover opacity-35"
          />
        </Link>
      )}

      <div className="article-body">
        <div className="space-y-3">
          <div className="article-meta-row">
            <span className="article-source">{sourceName}</span>
            <div className="article-score">
              <span className="article-score-label">Score</span>
              <span className="article-score-value">{score}</span>
            </div>
          </div>

          <Link href={detailHref} className="article-title-link block">
            <h2 title={title}>{title}</h2>
          </Link>
        </div>

        {summaryForClamp ? (
          <div className="article-summary text-sm">{renderSummaryMarkdown(summaryForClamp)}</div>
        ) : null}

        <div className="article-footer">
          <div className="article-footer-meta">
            <span>{formatDateTime(publishedAt)}</span>
            {lifecycleBadges.length > 0 && (
              <span className={`status-badge !text-[9px] ${lifecycleBadges[0].toneClass}`}>
                {lifecycleBadges[0].label}
              </span>
            )}
          </div>

          <div className="article-footer-actions">
            <Link href={detailHref} className="btn btn-primary !py-2 !px-4 !text-[11px] flex-1">
              Ler análise
            </Link>
            {url ? (
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="btn btn-secondary !py-2 !px-3 !text-[11px]"
                title="Abrir link externo"
              >
                Fonte
              </a>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}
