"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { siteNav } from "@/lib/site-nav";

function isActive(pathname, href) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function MainNav() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  return (
    <nav className="main-nav" aria-label="Navegação principal">
      <div className="nav-desktop nav-cluster">
        {siteNav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`nav-link ${isActive(pathname, item.href) ? "active" : ""}`}
          >
            {item.label}
          </Link>
        ))}
      </div>

      <div className="nav-mobile-shell">
        <button
          type="button"
          className={`mobile-nav-toggle ${isOpen ? "is-open" : ""}`}
          aria-expanded={isOpen}
          aria-controls="mobile-nav-panel"
          aria-label={isOpen ? "Fechar menu" : "Abrir menu"}
          onClick={() => setIsOpen((current) => !current)}
        >
          <span className="sr-only">{isOpen ? "Fechar menu" : "Abrir menu"}</span>
          <span className="mobile-nav-icon" aria-hidden>
            <span />
            <span />
            <span />
          </span>
        </button>

        <div className={`mobile-nav-overlay ${isOpen ? "is-open" : ""}`} onClick={() => setIsOpen(false)} />

        <div id="mobile-nav-panel" className={`mobile-nav-drawer ${isOpen ? "is-open" : ""}`}>
          <div className="mobile-nav-drawer-header">
            <div className="mobile-nav-toggle-copy">
              <span className="mobile-nav-kicker">Menu</span>
              <span className="mobile-nav-current">
                {siteNav.find((item) => isActive(pathname, item.href))?.label || "Anime Radar"}
              </span>
            </div>
            <button
              type="button"
              className="mobile-nav-close"
              aria-label="Fechar menu"
              onClick={() => setIsOpen(false)}
            >
              ×
            </button>
          </div>

          <div className="mobile-nav-panel">
            <div className="mobile-nav-list">
              {siteNav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`mobile-nav-link ${isActive(pathname, item.href) ? "active" : ""}`}
                >
                  <span>{item.label}</span>
                  <span className="mobile-nav-link-arrow" aria-hidden>→</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
