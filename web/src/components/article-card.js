import Link from "next/link";
import { getArticleLifecycleBadges } from "@/lib/article-state";
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
    <ul className="list-disc pl-5 space-y-1">
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
          <img
            src={imageUrl}
            alt={title || "Imagem de capa da notícia"}
            loading="lazy"
          />
        </Link>
      ) : (
        <div className="article-cover flex items-center justify-center bg-slate-100 text-slate-400">
          <span className="text-xs">Sem imagem</span>
        </div>
      )}

      <div className="flex flex-1 flex-col p-4 pt-0 gap-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-4 border-b border-slate-50 pb-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-rose-600 truncate">
              {sourceName}
            </span>
            <div className="flex items-center gap-1.5 shrink-0 bg-slate-800/50 px-2 py-1 rounded-md border border-slate-700">
              <span className="text-[9px] font-bold text-slate-500 uppercase">Score</span>
              <span className="text-xs font-black text-rose-400">{score}</span>
            </div>
          </div>
          
          <Link href={detailHref} className="article-title-link block">
            <h2 title={title} className="text-base font-bold leading-tight line-clamp-2">
              {title}
            </h2>
          </Link>
        </div>

        {summaryForClamp ? (
          <p className="article-summary text-sm text-slate-500 line-clamp-3 leading-relaxed">
            {renderSummaryMarkdown(summaryForClamp)}
          </p>
        ) : null}

        <div className="mt-auto space-y-4">
          <div className="flex items-center justify-between gap-2 text-[10px] text-slate-400 font-medium">
            <span>{formatDateTime(publishedAt)}</span>
            {lifecycleBadges.length > 0 && (
              <span className={`status-badge !text-[9px] ${lifecycleBadges[0].toneClass}`}>
                {lifecycleBadges[0].label}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 border-t border-slate-50 pt-3">
            <Link href={detailHref} className="btn btn-primary !py-1.5 !px-4 !text-[11px] flex-1">
              Detalhes
            </Link>
            {url && (
              <a 
                href={url} 
                target="_blank" 
                rel="noreferrer" 
                className="btn btn-secondary !py-1.5 !px-3 !text-[11px]"
                title="Abrir link externo"
              >
                🔗
              </a>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
