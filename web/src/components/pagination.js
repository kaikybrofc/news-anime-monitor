import Link from "next/link";

function normalizeQueryEntries(searchParams = {}) {
  return Object.entries(searchParams).reduce((acc, [key, value]) => {
    if (value === undefined || value === null) return acc;
    const parsed = Array.isArray(value) ? value[0] : value;
    const text = String(parsed).trim();
    if (!text) return acc;
    acc[key] = text;
    return acc;
  }, {});
}

function buildHref(pathname, searchParams, updates = {}) {
  const baseParams = normalizeQueryEntries(searchParams);
  const merged = { ...baseParams, ...updates };
  const query = new URLSearchParams();
  Object.entries(merged).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    const text = String(value).trim();
    if (!text) return;
    query.set(key, text);
  });
  const queryString = query.toString();
  return queryString ? `${pathname}?${queryString}` : pathname;
}

export function Pagination({ pathname, searchParams, offset, limit, hasMore }) {
  const safeOffset = Math.max(0, Number(offset) || 0);
  const safeLimit = Math.max(1, Number(limit) || 20);
  const previousOffset = Math.max(0, safeOffset - safeLimit);
  const nextOffset = safeOffset + safeLimit;
  const canGoBack = safeOffset > 0;
  const currentPage = Math.floor(safeOffset / safeLimit) + 1;

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-6 w-full">
      <div className="flex flex-col gap-1 items-center sm:items-start order-2 sm:order-1">
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Navegação</span>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-400">Página atual:</span>
          <span className="text-sm font-black text-rose-500">{currentPage}</span>
        </div>
      </div>

      <div className="flex items-center gap-3 order-1 sm:order-2 w-full sm:w-auto">
        {canGoBack ? (
          <Link
            className="btn btn-secondary !py-2.5 !px-6 text-xs flex-1 sm:flex-none text-center justify-center"
            href={buildHref(pathname, searchParams, {
              offset: previousOffset,
              limit: safeLimit,
            })}
          >
            ← Anterior
          </Link>
        ) : (
          <span className="btn btn-disabled !py-2.5 !px-6 text-xs flex-1 sm:flex-none text-center justify-center opacity-30">
            Anterior
          </span>
        )}

        {hasMore ? (
          <Link
            className="btn btn-primary !py-2.5 !px-8 text-xs flex-1 sm:flex-none text-center justify-center shadow-lg shadow-rose-500/10"
            href={buildHref(pathname, searchParams, {
              offset: nextOffset,
              limit: safeLimit,
            })}
          >
            Próxima →
          </Link>
        ) : (
          <span className="btn btn-disabled !py-2.5 !px-8 text-xs flex-1 sm:flex-none text-center justify-center opacity-30">
            Fim da Lista
          </span>
        )}
      </div>
    </div>
  );
}
