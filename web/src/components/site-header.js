 "use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { MainNav } from "@/components/main-nav";

export function SiteHeader() {
  const [hidden, setHidden] = useState(false);
  const lastScrollYRef = useRef(0);
  const upStepsRef = useRef(0);

  useEffect(() => {
    function handleScroll() {
      const currentY = Math.max(0, window.scrollY || 0);
      const previousY = lastScrollYRef.current;
      const delta = currentY - previousY;
      lastScrollYRef.current = currentY;

      if (Math.abs(delta) < 8) return;

      if (currentY <= 20) {
        upStepsRef.current = 0;
        setHidden(false);
        return;
      }

      if (delta > 0) {
        upStepsRef.current = 0;
        if (!hidden) setHidden(true);
        return;
      }

      upStepsRef.current += 1;
      if (upStepsRef.current >= 2) {
        setHidden(false);
        upStepsRef.current = 0;
      }
    }

    lastScrollYRef.current = window.scrollY || 0;
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [hidden]);

  return (
    <header className={`site-header ${hidden ? "site-header--hidden" : ""}`.trim()}>
      <div className="site-container header-inner">
        <div className="flex items-center gap-4">
          <Link href="/" className="brand" aria-label="Ir para a página inicial">
            <img
              src="/brand/logo-64.png"
              alt="OmniZap Anime Radar"
              className="brand-logo"
              width="28"
              height="28"
            />
            <span>Anime Radar</span>
          </Link>
        </div>
        <MainNav />
      </div>
    </header>
  );
}
