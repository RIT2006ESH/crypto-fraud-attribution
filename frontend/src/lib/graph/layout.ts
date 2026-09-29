import type { GraphView } from './model';

/**
 * Layout strategy selection.
 *
 * One set of dagre parameters is wrong for every investigation. A four-node path and a
 * sixty-node hub want different rank spacing, different node separation and different
 * alignment, and forcing either onto the other's settings is what produces a graph
 * squeezed into a corner or one sprawling past the canvas.
 *
 * The strategy is chosen from the shape of the trace, then the spacing is solved
 * against the actual node count so the drawing lands near the same apparent scale
 * whether it has six nodes or sixty.
 */

export type LayoutStrategy = 'path' | 'layered' | 'radial-hybrid' | 'dense';

export interface GraphLayoutInput {
  nodeCount: number;
  edgeCount: number;
  maxHop: number;
  /** Mean out-degree across all nodes. */
  branchingFactor: number;
  /** Edges per node, normalised. */
  density: number;
}

export interface LayoutPlan {
  strategy: LayoutStrategy;
  /** A sentence for the interface, so the choice is never invisible to the user. */
  reason: string;
  rankDir: 'LR' | 'TB';
  nodeSep: number;
  nodeDimensionsIncludeLabels: boolean;
  rankSep: number;
  edgeSep: number;
  edgeLabelSpace: number;
  ranker: 'network-simplex' | 'tight-tree' | 'longest-path';
  /** Dagre's `align` — chosen per strategy rather than hard-coded. */
  align: 'UL' | 'ULC' | 'UR' | 'DL' | 'JUSTIFY';
  rank: string;
  marginX: number;
  marginY: number;
  animate: boolean;
}

const DEFAULTS: LayoutPlan = {
  strategy: 'layered',
  reason: '',
  rankDir: 'LR',
  nodeSep: 60,
  nodeDimensionsIncludeLabels: false,
  rankSep: 170,
  edgeSep: 22,
  edgeLabelSpace: 0,
  ranker: 'network-simplex',
  align: 'UL',
  rank: undefined as unknown as string,
  marginX: 24,
  marginY: 24,
  animate: false,
};

export function getGraphLayout(input: GraphLayoutInput): LayoutPlan {
  const { nodeCount, maxHop, branchingFactor, density } = input;
  const plan = { ...DEFAULTS };

  /* Branching is what decides the shape. A trace that is essentially a line wants the
     horizontal rank treatment; anything that forks wants more rank separation than
     node separation, so branches get room to breathe instead of stacking. */
  const isLinear = branchingFactor < 1.4 && maxHop >= 2;
  const isStar = maxHop <= 1 && branchingFactor > 3;
  const isDense = nodeCount > 34 || density > 2.6;

  if (isLinear && nodeCount <= 14) {
    plan.strategy = 'path';
    plan.reason = 'Linear trace — ranks run left to right with wide rank gaps.';
    plan.rankDir = 'LR';
    plan.nodeSep = 78;
    plan.rankSep = 230;
    plan.edgeSep = 30;
    plan.align = 'UL';
  } else if (isStar && nodeCount > 8) {
    plan.strategy = 'radial-hybrid';
    plan.reason = 'Single-hop fan-out — one rank held close, spokes spread vertically.';
    plan.rankDir = 'LR';
    plan.nodeSep = 54;
    plan.rankSep = 150;
    plan.edgeSep = 14;
    plan.align = 'ULC';
  } else if (isDense) {
    plan.strategy = 'dense';
    plan.reason = 'Dense trace — transfers aggregated and spacing tightened to protect legibility.';
    plan.rankDir = 'LR';
    /* Dense graphs get *less* separation per node, not more: sixty nodes with 120px
       ranks is a graph that cannot be seen without zooming out past legibility. */
    plan.nodeSep = 34 + Math.max(0, 30 - nodeCount / 4);
    plan.rankSep = 120 + maxHop * 14;
    plan.edgeSep = 8;
    plan.align = 'UL';
  } else {
    plan.strategy = 'layered';
    plan.reason = 'Branching trace — hierarchical ranks with room between branches.';
    plan.rankDir = 'LR';
    plan.nodeSep = 64;
    plan.rankSep = 150 + maxHop * 10;
    plan.edgeSep = 18;
    plan.align = 'UL';
  }

  /* Crossing reduction. `tight-tree` is faster but produces more crossings; on a graph
     wide enough to matter, spending the extra time is the right trade. */
  plan.ranker = nodeCount > 45 ? 'network-simplex' : plan.ranker;
  plan.marginX = 28;
  plan.marginY = 28;
  return plan;
}

/** The options object handed straight to Cytoscape. */
export function toDagreOptions(plan: LayoutPlan, animate = false) {
  return {
    name: 'dagre',
    rankDir: plan.rankDir,
    nodeSep: plan.nodeSep,
    nodeDimensionsIncludeLabels: plan.nodeDimensionsIncludeLabels,
    rankSep: plan.rankSep,
    edgeSep: plan.edgeSep,
    edgeLabelSpace: plan.edgeLabelSpace,
    ranker: plan.ranker,
    align: plan.align,
    marginX: plan.marginX,
    marginY: plan.marginY,
    animate,
    animationDuration: animate ? 420 : 0,
    fit: true,
  };
}

export function describeView(view: GraphView): GraphLayoutInput {
  const nodeCount = view.nodes.length;
  const maxHop = view.nodes.reduce((max, n) => Math.max(max, n.hopDepth), 0);
  const totalOut = view.nodes.reduce((sum, n) => sum + n.outgoing, 0);
  return {
    nodeCount,
    edgeCount: view.edges.length,
    maxHop,
    branchingFactor: nodeCount > 0 ? totalOut / nodeCount : 0,
    density: nodeCount > 0 ? view.edges.length / nodeCount : 0,
  };
}
