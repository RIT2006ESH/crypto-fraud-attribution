import type { Transition, Variants } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';

/**
 * Motion language.
 *
 * Four duration bands, three easings, one direction. Every reveal in the product
 * comes from this file so the marketing site and the workspace share a cadence.
 *
 *   micro        150–220ms  hover, press, copy, chip toggles
 *   small reveal 300–500ms  panels, rows, chips entering
 *   section      700–1000ms headlines, graphics, callouts
 *   choreography  800–1600ms hero sequences
 *
 * Nothing bounces, rotates or loops continuously. The one loop in the system is the
 * 2.4s "live" status pulse, which is a status signal rather than decoration.
 */

export const EASE = {
  /** Decelerating — the default for anything entering the screen. */
  out: [0.16, 1, 0.3, 1] as const,
  /** Softer settle, used for large typography. */
  soft: [0.22, 1, 0.36, 1] as const,
  /** Symmetric — used for scroll-scrubbed and reversible transitions. */
  inOut: [0.76, 0, 0.24, 1] as const,
};

export const DURATION = {
  micro: 0.18,
  small: 0.38,
  medium: 0.55,
  section: 0.85,
  hero: 1.15,
} as const;

export const transition = (duration = DURATION.small, delay = 0): Transition => ({
  duration,
  delay,
  ease: EASE.out,
});

/** Parent container that staggers its children. */
export const stagger = (step = 0.07, delayChildren = 0): Variants => ({
  hidden: {},
  show: {
    transition: { staggerChildren: step, delayChildren },
  },
});

/** The primary reveal: a short upward drift with a fade. */
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 26 },
  show: { opacity: 1, y: 0, transition: { duration: DURATION.section, ease: EASE.soft } },
};

export const fadeUpSm: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: DURATION.small, ease: EASE.out } },
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: DURATION.section, ease: EASE.soft } },
};

/** Used sparingly — reveals a container without a directional read. */
export const scaleSoft: Variants = {
  hidden: { opacity: 0, scale: 0.985 },
  show: { opacity: 1, scale: 1, transition: { duration: DURATION.section, ease: EASE.soft } },
};

/** Clips a panel open from the bottom — used on the product preview frame. */
export const clipReveal: Variants = {
  hidden: { opacity: 0, clipPath: 'inset(0% 0% 100% 0%)' },
  show: {
    opacity: 1,
    clipPath: 'inset(0% 0% 0% 0%)',
    transition: { duration: 1.1, ease: EASE.inOut },
  },
};

/** SVG path draw. Pair with a pathLength animation. */
export const lineDraw: Variants = {
  hidden: { pathLength: 0, opacity: 0 },
  show: { pathLength: 1, opacity: 1, transition: { duration: 1.4, ease: EASE.inOut } },
};

/** Slow parallax, expressed in pixels so callers can scale it. */
export function parallax(distance = 60) {
  return { hidden: { y: distance }, show: { y: -distance } };
}

export const VIEWPORT = { once: true, amount: 0.28 } as const;
export const VIEWPORT_EARLY = { once: true, amount: 0.1 } as const;

/** Named reveal variants accepted by <Reveal variant="…">. */
export type VariantsLike = 'fadeUp' | 'fadeUpSm' | 'fadeIn' | 'scaleSoft';

/**
 * Counts from 0 to `value` once the element enters the viewport.
 *
 * Reserved for capability counts on the marketing site. Live investigation numbers
 * are never animated from zero — an investigator reading a real case record should
 * not watch a real figure climb.
 */
export function useCountUp(value: number, duration = 1100) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const [display, setDisplay] = useState(0);
  const done = useRef(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || done.current) return;

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      setDisplay(value);
      done.current = true;
      return;
    }

    let raf = 0;
    let start = 0;

    const run = (now: number) => {
      if (!start) start = now;
      const t = Math.min((now - start) / duration, 1);
      // Same deceleration curve as the reveal easings, so numbers settle with the type.
      const eased = 1 - Math.pow(1 - t, 4);
      setDisplay(Math.round(value * eased));
      if (t < 1) raf = requestAnimationFrame(run);
      else done.current = true;
    };

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          observer.disconnect();
          raf = requestAnimationFrame(run);
        }
      },
      { threshold: 0.5 },
    );

    observer.observe(node);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [value, duration]);

  return { ref, display };
}

/** Maps a scroll progress value (0–1) onto an integer index with sane bounds. */
export function progressToIndex(progress: number, steps: number, endOffset = 0.08): number {
  const usable = Math.max(0, 1 - endOffset);
  const scaled = Math.min(Math.max((progress - endOffset / 2) / usable, 0), 0.999999);
  return Math.min(Math.floor(scaled * steps), steps - 1);
}
