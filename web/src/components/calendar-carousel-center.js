"use client";

import { useEffect } from "react";

export function CalendarCarouselCenter() {
  useEffect(() => {
    const carousel = document.querySelector("[data-calendar-carousel]");
    if (!(carousel instanceof HTMLElement)) return;

    const todayCard = carousel.querySelector('[data-day-bucket="today"]');
    const fallbackCard = carousel.querySelector(".calendar-carousel-item");
    const target = todayCard instanceof HTMLElement ? todayCard : fallbackCard;
    if (!(target instanceof HTMLElement)) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    requestAnimationFrame(() => {
      target.scrollIntoView({
        behavior: reducedMotion ? "auto" : "smooth",
        block: "nearest",
        inline: "center",
      });
    });
  }, []);

  return null;
}
