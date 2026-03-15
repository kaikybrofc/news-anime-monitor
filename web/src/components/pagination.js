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

  return (
    <div className="pagination-row">
      {canGoBack ? (
        <Link
          className="btn btn-secondary"
          href={buildHref(pathname, searchParams, {
            offset: previousOffset,
            limit: safeLimit,
          })}
        >
          Página anterior
        </Link>
      ) : (
        <span className="btn btn-disabled">Página anterior</span>
      )}

      {hasMore ? (
        <Link
          className="btn btn-primary"
          href={buildHref(pathname, searchParams, {
            offset: nextOffset,
            limit: safeLimit,
          })}
        >
          Próxima página
        </Link>
      ) : (
        <span className="btn btn-disabled">Fim da lista</span>
      )}
    </div>
  );
}
