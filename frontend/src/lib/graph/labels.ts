import type { GraphEdgeView, GraphNodeView, GraphView } from './model';

/**
 * Label strategy — progressive disclosure.
 *
 * The single largest cause of an unreadable fund-flow map is labelling everything at
 * maximum detail. Sixty nodes each carrying a full address, a label type and a
 * transfer count is not information, it is noise that hides the two nodes that matter.
 *
 * So labels are awarded in three bands by zoom, and within each band by the node's
 * own priority:
 *
 *   zoomed out   entity name, else a label tag, else nothing for the unlabelled mass
 *   mid zoom     short address, plus the tag for anything but unlabelled wallets
 *   zoomed in    full address, tag and transfer count
 *
 * Full values are never truncated on the canvas. The inspector and the ledger hold
 * them, and the graph is an index into those, not a replacement.
 */

export type ZoomBand = 'overview' | 'working' | 'detailed';

export function zoomBand(zoom: number): ZoomBand {
  if (zoom < 0.62) return 'overview';
  if (zoom < 1.15) return 'working';
  return 'detailed';
}

export interface NodeLabel {
  /** First line. */
  primary: string;
  /** Second line, when there is room and something worth saying. */
  secondary: string | null;
  tone: 'entity' | 'address' | 'tag';
}

export function nodeLabel(view: GraphNodeView, band: ZoomBand): NodeLabel | null {
  const address = shortAddress(view.id);
  const tag = tagFor(view);

  if (band === 'overview') {
    // At this distance only the things an investigator is looking for get ink.
    if (view.entityName) return { primary: view.entityName, secondary: null, tone: 'entity' };
    if (view.isRisk) return { primary: tag, secondary: null, tone: 'tag' };
    if (view.isRoot) return { primary: 'TARGET', secondary: null, tone: 'tag' };
    if (view.labelPriority >= 70) return { primary: tag, secondary: null, tone: 'tag' };
    return null;
  }

  if (band === 'working') {
    if (view.entityName) {
      return { primary: view.entityName, secondary: address, tone: 'entity' };
    }
    if (view.isRoot) {
      return { primary: 'TARGET', secondary: address, tone: 'tag' };
    }
    if (view.labelPriority >= 40) {
      return { primary: address, secondary: tag, tone: 'tag' };
    }
    return { primary: address, secondary: null, tone: 'address' };
  }

  // Detailed: the full address, with the count when it adds something.
  const count = view.transferCount;
  const second = count > 0 ? `${tag} · ${count} transfer${count === 1 ? '' : 's'}` : tag;
  return { primary: address, secondary: second, tone: view.isRoot ? 'tag' : 'address' };
}

function tagFor(view: GraphNodeView): string {
  if (view.isRoot) return 'TARGET';
  if (!view.labelType || view.labelType === 'UNLABELED') return 'UNLABELLED';
  return view.labelType;
}

export function shortAddress(address: string): string {
  if (address.length <= 16) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

/* ── Edge labels ──────────────────────────────────────────────────────────── */

/**
 * An edge label is a summary, never a ledger row. One transfer shows its amount;
 * several show a count and a total. Nothing is printed on an edge the investigator
 * has not zoomed into, because overlapping amounts are worse than no amounts.
 */
export interface EdgeLabel {
  primary: string;
  secondary: string | null;
}

export function edgeLabel(view: GraphEdgeView, band: ZoomBand): EdgeLabel | null {
  if (band === 'overview') {
    // Only the few edges that carry the story get a label at this distance.
    if (view.transferCount < 3 && !view.onKeyPath) return null;
    return {
      primary: view.transferCount > 1 ? `${view.transferCount} transfers` : formatShort(view.totalAmount),
      secondary: null,
    };
  }

  if (view.transferCount === 1) {
    return { primary: formatShort(view.totalAmount), secondary: view.assetLabel };
  }

  return {
    primary: `${view.transferCount} transfers`,
    secondary: view.assetLabel === 'native' ? null : view.assetLabel,
  };
}

export function edgeTooltip(view: GraphEdgeView): string {
  if (view.transferCount === 1) {
    return `${formatAmountShort(view.totalAmount)} ${view.assetLabel} · 1 transfer`;
  }
  return `${view.transferCount} transfers · ${formatAmountShort(view.totalAmount)} ${view.assetLabel}`;
}

function formatShort(value: number): string {
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
  if (value >= 1) return value.toFixed(2);
  if (value >= 0.0001) return value.toFixed(4);
  return value.toExponential(1);
}

function formatAmountShort(value: number): string {
  return value >= 1 ? value.toLocaleString(undefined, { maximumFractionDigits: 2 }) : formatShort(value);
}

/* ── Label budgeting ──────────────────────────────────────────────────────── */

/**
 * Caps how many nodes may be labelled at once.
 *
 * Once a graph is dense, the number of labels is the limiting factor on legibility, not
 * the number of nodes. The highest-priority nodes take the budget; the rest stay
 * unlabelled until the investigator zooms in. This is a display decision only —
 * nothing is removed from the graph or from the ledger.
 */
export function labelBudget(band: ZoomBand, nodeCount: number): number {
  switch (band) {
    case 'overview':
      return nodeCount <= 12 ? nodeCount : Math.max(6, Math.round(nodeCount * 0.22));
    case 'working':
      return nodeCount <= 20 ? nodeCount : Math.max(10, Math.round(nodeCount * 0.45));
    default:
      return nodeCount;
  }
}

/** The nodes that may carry a label at this band, highest priority first. */
export function labelCandidates(view: GraphView, band: ZoomBand): Set<string> {
  const budget = labelBudget(band, view.nodes.length);
  if (budget >= view.nodes.length) return new Set(view.nodes.map((n) => n.id));
  return new Set(
    [...view.nodes]
      .sort((a, b) => b.labelPriority - a.labelPriority || b.transferCount - a.transferCount)
      .slice(0, budget)
      .map((n) => n.id),
  );
}
