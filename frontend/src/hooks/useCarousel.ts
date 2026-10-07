import { useCallback, useEffect, useRef, useState } from 'react';
import type { TouchEvent } from 'react';

const SWIPE_THRESHOLD = 40;

export function useCarousel(total: number, autoplayMs = 6000) {
  const [active, setActive] = useState(0);
  const touchStartX = useRef<number | null>(null);

  const goTo = useCallback((index: number) => setActive((index + total) % total), [total]);
  const next = useCallback(() => goTo(active + 1), [active, goTo]);
  const prev = useCallback(() => goTo(active - 1), [active, goTo]);

  useEffect(() => {
    if (total <= 1 || autoplayMs <= 0) return;
    const timer = setInterval(() => setActive((current) => (current + 1) % total), autoplayMs);
    return () => clearInterval(timer);
  }, [active, total, autoplayMs]);

  const swipeHandlers = {
    onTouchStart: (e: TouchEvent) => {
      touchStartX.current = e.touches[0].clientX;
    },
    onTouchEnd: (e: TouchEvent) => {
      if (touchStartX.current === null) return;
      const delta = e.changedTouches[0].clientX - touchStartX.current;
      touchStartX.current = null;
      if (Math.abs(delta) < SWIPE_THRESHOLD) return;
      if (delta < 0) next();
      else prev();
    },
  };

  return { active, goTo, next, prev, swipeHandlers };
}
