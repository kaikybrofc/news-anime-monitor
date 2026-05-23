"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef } from "react";
import { MainNav } from "@/components/main-nav";
import { ThemeToggle } from "@/components/theme-toggle";

export function SiteHeader() {
  const HIDE_DISTANCE = 72;
  const SHOW_DISTANCE = 44;
  const MIN_TOGGLE_INTERVAL_MS = 220;
  const headerRef = useRef(null);
  const hiddenRef = useRef(false);
  const lastScrollYRef = useRef(0);
  const lastDirectionRef = useRef(0);
  const scrollAccumulatorRef = useRef(0);
  const lastToggleAtRef = useRef(0);
  const tickingRef = useRef(false);

  useEffect(() => {
    function updateHeaderState() {
      const currentY = Math.max(0, window.scrollY || 0);
      const previousY = lastScrollYRef.current;
      const delta = currentY - previousY;
      lastScrollYRef.current = currentY;

      if (Math.abs(delta) < 4) return hiddenRef.current;

      if (currentY <= 20) {
        scrollAccumulatorRef.current = 0;
        lastDirectionRef.current = 0;
        return false;
      }

      const direction = delta > 0 ? 1 : -1;
      if (direction !== lastDirectionRef.current) {
        lastDirectionRef.current = direction;
        scrollAccumulatorRef.current = Math.abs(delta);
      } else {
        scrollAccumulatorRef.current += Math.abs(delta);
      }

      const now = Date.now();
      const elapsedSinceToggle = now - lastToggleAtRef.current;
      if (elapsedSinceToggle < MIN_TOGGLE_INTERVAL_MS) {
        return hiddenRef.current;
      }

      if (!hiddenRef.current && direction > 0 && scrollAccumulatorRef.current >= HIDE_DISTANCE) {
        scrollAccumulatorRef.current = 0;
        lastToggleAtRef.current = now;
        return true;
      }

      if (hiddenRef.current && direction < 0 && scrollAccumulatorRef.current >= SHOW_DISTANCE) {
        scrollAccumulatorRef.current = 0;
        lastToggleAtRef.current = now;
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
        <div className="header-top-row">
          <Link href="/" className="brand" aria-label="Ir para a página inicial">
            <Image
              src="/brand/logo-64.png"
              alt="OmniZap Anime Radar"
              className="brand-logo"
              width={44}
              height={44}
              sizes="44px"
              priority
            />
            <span className="brand-copy">
              <span className="brand-title">Anime Radar</span>
              <span className="brand-subtitle">editorial intelligence</span>
            </span>
          </Link>

          <div className="header-controls">
            <ThemeToggle />
            <MainNav />
          </div>
        </div>
      </div>
    </header>
  );
}
