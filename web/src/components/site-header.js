"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef } from "react";
import { MainNav } from "@/components/main-nav";

export function SiteHeader() {
  const headerRef = useRef(null);
  const hiddenRef = useRef(false);
  const lastScrollYRef = useRef(0);
  const upStepsRef = useRef(0);
  const tickingRef = useRef(false);

  useEffect(() => {
    function updateHeaderState() {
      const currentY = Math.max(0, window.scrollY || 0);
      const previousY = lastScrollYRef.current;
      const delta = currentY - previousY;
      lastScrollYRef.current = currentY;

      if (Math.abs(delta) < 8) return false;

      if (currentY <= 20) {
        upStepsRef.current = 0;
        return false;
      }

      if (delta > 0) {
        upStepsRef.current = 0;
        return true;
      }

      upStepsRef.current += 1;
      if (upStepsRef.current >= 2) {
        upStepsRef.current = 0;
        return false;
      }

      return hiddenRef.current;
    }

    function handleScroll() {
      if (tickingRef.current) return;
      tickingRef.current = true;
      window.requestAnimationFrame(() => {
        const nextHidden = updateHeaderState();
        if (hiddenRef.current !== nextHidden) {
          hiddenRef.current = nextHidden;
          if (headerRef.current) {
            headerRef.current.classList.toggle("site-header--hidden", nextHidden);
          }
        }
        tickingRef.current = false;
      });
    }

    lastScrollYRef.current = window.scrollY || 0;
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header ref={headerRef} className="site-header">
      <div className="site-container header-inner">
        <div className="flex items-center gap-4">
          <Link href="/" className="brand" aria-label="Ir para a página inicial">
            <Image
              src="/brand/logo-64.png"
              alt="OmniZap Anime Radar"
              className="brand-logo"
              width={28}
              height={28}
              sizes="28px"
              priority
            />
            <span>Anime Radar</span>
          </Link>
        </div>
        <MainNav />
      </div>
    </header>
  );
}
