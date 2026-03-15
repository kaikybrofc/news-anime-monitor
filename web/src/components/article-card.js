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
  const summary = summarizeText(refined.summary || "", 100);
  const tags = buildTagList(article);
  const lifecycleBadges = getArticleLifecycleBadges(article);
  const sourceName = String(refined.sourceName || refined.sourceId || "fonte desconhecida");
  const publishedAt = refined.publishedAt || article.publishedAt || article.timestamp;
  const score = formatNumber(refined.score || 0);
  const detailHref = articleId ? `/noticias/${articleId}` : "/noticias";

  return (
    <article className="info-card article-card group">
      {imageUrl ? (
        <Link href={detailHref} className="article-cover" title="Abrir detalhe da noticia">
          <img src={imageUrl} alt={title} loading="lazy" />
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

        {summary ? (
          <p className="article-summary text-sm text-slate-500 line-clamp-3 leading-relaxed">
            {summary}
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
                title="Link Externo"
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
