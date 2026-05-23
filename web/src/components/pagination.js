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
    <div className="pagination-shell">
      <div className="flex w-full flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <span className="page-kicker">Navegação</span>
          <div className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
            <span>Página atual</span>
            <span className="text-lg font-semibold text-[var(--title)]" style={{ fontFamily: "var(--font-heading), ui-serif, Georgia, serif" }}>
              {currentPage}
            </span>
          </div>
        </div>

        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
          {canGoBack ? (
            <Link
              className="btn btn-secondary !py-2.5 !px-6 text-xs justify-center"
              href={buildHref(pathname, searchParams, {
                offset: previousOffset,
                limit: safeLimit,
              })}
            >
              ← Página anterior
            </Link>
          ) : (
            <span className="btn btn-disabled !py-2.5 !px-6 text-xs justify-center opacity-60">
              Página anterior
            </span>
          )}

          {hasMore ? (
            <Link
              className="btn btn-primary !py-2.5 !px-7 text-xs justify-center"
              href={buildHref(pathname, searchParams, {
                offset: nextOffset,
                limit: safeLimit,
              })}
            >
              Próxima página →
            </Link>
          ) : (
            <span className="btn btn-disabled !py-2.5 !px-7 text-xs justify-center opacity-60">
              Fim da coleção
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
