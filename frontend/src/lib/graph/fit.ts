import type { Core } from 'cytoscape';

/**
 * Controlled graph fitting.
 *
 * `cy.fit()` is the source of most bad empty canvas: it centres the bounding box with
 * a fixed padding, so a graph that is wider than it is tall ends up shrunken and
 * stranded, and a five-node trace ends up marooned in a sea of background. It also
 * fires on every update by default, which destroys whatever the investigator had
 * panned to.
 *
 * Fitting here is explicit and single-shot. It:
 *
 *   1. takes the bounding box of the *visible* elements only;
 *   2. solves the zoom that fills the canvas inside a padding budget, clamped to a
 *      band that keeps text legible at both ends;
 *   3. centres the box on the canvas' own midpoint;
 *   4. refuses to zoom past 1 when the graph is smaller than the canvas, so a small
 *      trace stays at a natural scale instead of being inflated.
 */

export interface FitOptions {
  /** Breathing room as a fraction of the smaller viewport dimension. */
  padding?: number;
  /** Upper bound, so a three-node trace is never blown up to fill a 4K display. */
  maxZoom?: number;
  /** Lower bound, past which labels stop being readable. */
  minZoom?: number;
  animate?: boolean;
  duration?: number;
}

const DEFAULTS = {
  padding: 0.08,
  maxZoom: 1.15,
  minZoom: 0.28,
  animate: true,
  duration: 420,
};

/** The zoom that makes `box` fill the viewport inside a padding fraction. */
export function solveFitZoom(
  box: { x1: number; y1: number; x2: number; y2: number; w: number; h: number },
  viewport: { width: number; height: number },
  options: FitOptions = {},
): number {
  const { padding = DEFAULTS.padding, maxZoom = DEFAULTS.maxZoom, minZoom = DEFAULTS.minZoom } = options;
  if (box.w <= 0 || box.h <= 0 || viewport.width <= 0 || viewport.height <= 0) return 1;

  const usableW = viewport.width * (1 - padding * 2);
  const usableH = viewport.height * (1 - padding * 2);
  const zoom = Math.min(usableW / box.w, usableH / box.h);

  // A graph smaller than the canvas is left at 1:1. Scaling it up to "fill" the space
  // is what turns a four-node trace into four enormous circles.
  return Math.min(maxZoom, Math.max(minZoom, Math.min(zoom, 1)));
}

/** Centre of the viewport in model coordinates, which is what `cy.center` wants. */
/**
 * Fit whatever is currently visible.
 *
 * Visibility is read from the rendered elements rather than from a caller-supplied
 * set, so the fit can never disagree with what the user is actually looking at.
 *
 * `respectExisting` is what makes filters and selections non-destructive: the graph is
 * only re-framed when the user asks, or on the first fit after a new trace.
 */
export function fitGraph(cy: Core, options: FitOptions & { respectExisting?: boolean } = {}): void {
  const {
    animate = DEFAULTS.animate,
    duration = DEFAULTS.duration,
    respectExisting = false,
  } = options;

  const visible = cy.nodes().filter((n) => n.style('display') !== 'none' && !n.hasClass('is-hidden'));
  if (visible.length === 0) return;

  const box = visible.boundingBox({ includeLabels: false, includeNodes: true });
  if (!box || box.w <= 0 || box.h <= 0) return;

  const zoom = solveFitZoom(box, { width: cy.width(), height: cy.height() }, options);
  const target = {
    x: (box.x1 + box.x2) / 2,
    y: (box.y1 + box.y2) / 2,
  };

  const pan = {
    x: cy.width() / 2 - target.x * zoom,
    y: cy.height() / 2 - target.y * zoom,
  };

  if (respectExisting && Math.abs(cy.zoom() - zoom) < 0.02) return;

  if (animate && !prefersReducedMotion()) {
    cy.animate({ zoom, pan, duration, easing: 'ease-out-cubic' });
  } else {
    cy.zoom(zoom);
    cy.pan(pan);
  }
}

/** How much of the canvas the visible graph occupies, for the diagnostics readout. */
export function fillRatio(cy: Core, hidden: Set<string> | null): number {
  const visible = cy.nodes().filter((n) => !hidden?.has(n.id()));
  if (visible.length === 0) return 0;
  const box = visible.boundingBox({ includeLabels: false, includeNodes: true });
  if (!box || box.w <= 0 || box.h <= 0) return 0;
  const area = box.w * box.h;
  const viewportArea = cy.width() * cy.height() / (cy.zoom() * cy.zoom());
  return Math.min(1, area / Math.max(1, viewportArea));
}

export function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}
