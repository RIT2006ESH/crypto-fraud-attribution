import { useEffect, useState } from 'react';

/**
 * Tracks whether the page has scrolled past a threshold — drives the compact,
 * blurred navigation state without a scroll listener doing layout work.
 */
export function useScrolledPast(threshold = 24): boolean {
  const [past, setPast] = useState(false);

  useEffect(() => {
    let frame = 0;

    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        setPast(window.scrollY > threshold);
      });
    };

    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [threshold]);

  return past;
}
