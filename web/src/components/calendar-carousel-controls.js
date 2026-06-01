"use client";

import { useEffect, useState } from "react";

export function CalendarCarouselControls() {
  const [canGoLeft, setCanGoLeft] = useState(false);
  const [canGoRight, setCanGoRight] = useState(false);

  useEffect(() => {
    const carousel = document.querySelector("[data-calendar-carousel]");
    if (!(carousel instanceof HTMLElement)) return;

    const updateButtons = () => {
      const maxScrollLeft = carousel.scrollWidth - carousel.clientWidth;
      setCanGoLeft(carousel.scrollLeft > 6);
      setCanGoRight(carousel.scrollLeft < maxScrollLeft - 6);
    };

    updateButtons();
    carousel.addEventListener("scroll", updateButtons, { passive: true });
    window.addEventListener("resize", updateButtons);

    return () => {
      carousel.removeEventListener("scroll", updateButtons);
      window.removeEventListener("resize", updateButtons);
    };
  }, []);

  const move = (direction = 1) => {
    const carousel = document.querySelector("[data-calendar-carousel]");
    if (!(carousel instanceof HTMLElement)) return;
    const step = Math.round(carousel.clientWidth * 0.82);
    carousel.scrollBy({
      left: step * direction,
      behavior: "smooth",
    });
  };

  return (
    <div className="calendar-carousel-controls" role="group" aria-label="Navegacao do calendario">
      <button
        type="button"
        className="btn btn-secondary calendar-carousel-control"
        onClick={() => move(-1)}
        disabled={!canGoLeft}
      >
        Anterior
      </button>
      <button
        type="button"
        className="btn btn-secondary calendar-carousel-control"
        onClick={() => move(1)}
        disabled={!canGoRight}
      >
        Proximo
      </button>
    </div>
  );
}
