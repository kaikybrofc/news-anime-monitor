"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 220;
const TYPE_LABEL = {
  noticia: "Notícia",
  franquia: "Franquia",
  fonte: "Fonte",
};

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

export function UnifiedSearch({
  initialQuery = "",
  placeholder = "Buscar notícia, franquia ou fonte...",
  submitLabel = "Buscar",
  className = "",
}) {
  const router = useRouter();
  const wrapperRef = useRef(null);
  const [query, setQuery] = useState(String(initialQuery || ""));
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [errorMessage, setErrorMessage] = useState("");

  const trimmedQuery = useMemo(() => query.trim(), [query]);

  useEffect(() => {
    setQuery(String(initialQuery || ""));
  }, [initialQuery]);

  useEffect(() => {
    function handleOutsideClick(event) {
      if (!wrapperRef.current) return;
      if (wrapperRef.current.contains(event.target)) return;
      setOpen(false);
      setSelectedIndex(-1);
    }

    document.addEventListener("mousedown", handleOutsideClick);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, []);

  useEffect(() => {
    if (trimmedQuery.length < MIN_QUERY_LENGTH) {
      setItems([]);
      setLoading(false);
      setErrorMessage("");
      setSelectedIndex(-1);
      return undefined;
    }

    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      setLoading(true);
      setErrorMessage("");

      try {
        const response = await fetch(`/api/search-suggest?q=${encodeURIComponent(trimmedQuery)}`, {
          signal: controller.signal,
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Falha ao carregar sugestões.");
        }

        const payload = await response.json();
        const nextItems = Array.isArray(payload?.items) ? payload.items : [];
        setItems(nextItems);
        setOpen(true);
        setSelectedIndex(nextItems.length ? 0 : -1);
      } catch (error) {
        if (controller.signal.aborted) return;
        setItems([]);
        setOpen(true);
        setSelectedIndex(-1);
        setErrorMessage(error.message || "Falha ao carregar sugestões.");
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [trimmedQuery]);

  function navigateTo(href = "") {
    const target = String(href || "").trim();
    if (!target) return;
    setOpen(false);
    setSelectedIndex(-1);
    router.push(target);
  }

  function submitToNews() {
    if (!trimmedQuery) {
      navigateTo("/noticias");
      return;
    }
    navigateTo(`/noticias?q=${encodeURIComponent(trimmedQuery)}&offset=0`);
  }

  function handleSubmit(event) {
    event.preventDefault();
    if (open && selectedIndex >= 0 && items[selectedIndex]) {
      navigateTo(items[selectedIndex].href);
      return;
    }
    submitToNews();
  }

  function handleKeyDown(event) {
    if (!open || !items.length) {
      if (event.key === "ArrowDown" && items.length) {
        event.preventDefault();
        setOpen(true);
        setSelectedIndex(0);
      }
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setSelectedIndex((current) => {
        const next = current + 1;
        return next >= items.length ? 0 : next;
      });
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setSelectedIndex((current) => {
        const next = current - 1;
        return next < 0 ? items.length - 1 : next;
      });
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      setSelectedIndex(-1);
    }
  }

  return (
    <div ref={wrapperRef} className={`relative ${className}`.trim()}>
      <div className="search-shell">
        <form action="/noticias" method="get" onSubmit={handleSubmit} className="search-input-shell">
          <input type="hidden" name="offset" value="0" />
          <input
            type="text"
            name="q"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setOpen(true);
            }}
            onFocus={() => {
              if (trimmedQuery.length >= MIN_QUERY_LENGTH) {
                setOpen(true);
              }
            }}
            onKeyDown={handleKeyDown}
            autoComplete="off"
            placeholder={placeholder}
            className="search-input"
          />
          <button type="submit" className="btn btn-primary !px-6 !py-3 text-sm">
            {submitLabel}
          </button>
        </form>
      </div>

      {open ? (
        <div className="search-dropdown">
          {loading ? <p className="px-4 py-4 text-sm text-[var(--muted-foreground)]">Buscando sugestões...</p> : null}

          {!loading && errorMessage ? (
            <p className="px-4 py-4 text-sm text-rose-300">{errorMessage}</p>
          ) : null}

          {!loading && !errorMessage && trimmedQuery.length < MIN_QUERY_LENGTH ? (
            <p className="px-4 py-4 text-sm text-[var(--muted-foreground)]">
              Digite ao menos {MIN_QUERY_LENGTH} caracteres.
            </p>
          ) : null}

          {!loading && !errorMessage && trimmedQuery.length >= MIN_QUERY_LENGTH && !items.length ? (
            <p className="px-4 py-4 text-sm text-[var(--muted-foreground)]">
              Nenhum resultado encontrado. Pressione Enter para buscar em notícias.
            </p>
          ) : null}

          {!loading && !errorMessage && items.length ? (
            <ul className="flex max-h-96 flex-col gap-1 overflow-y-auto">
              {items.map((item, index) => {
                const isActive = index === selectedIndex;
                return (
                  <li key={item.id || `${item.type}-${index}`}>
                    <button
                      type="button"
                      onMouseDown={(event) => {
                        event.preventDefault();
                        navigateTo(item.href);
                      }}
                      onMouseEnter={() => setSelectedIndex(index)}
                      className={`search-option ${isActive ? "is-active" : ""}`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="search-type-badge">{TYPE_LABEL[item.type] || "Resultado"}</span>
                        <span className="line-clamp-1 text-sm font-semibold text-[var(--title)]">
                          {renderInlineMarkdown(item.title)}
                        </span>
                      </div>
                      {item.subtitle ? (
                        <span className="line-clamp-1 text-xs text-[var(--muted-foreground)]">
                          {renderInlineMarkdown(item.subtitle)}
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
