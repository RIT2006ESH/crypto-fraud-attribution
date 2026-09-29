import type { EdgeDto, LabelType, NodeDto, TraceResult } from '../types';

/**
 * Graph view model.
 *
 * The Cytoscape instance stays the single source of truth for the canvas. This file
 * owns everything React needs to describe a *view* over that graph: which entities
 * are visible, which element is selected, and how emphasis is distributed.
 */

export type GraphFilter = 'all' | 'known' | 'high-risk' | 'mixers' | 'sanctioned' | 'unlabelled';
export type GraphMode = 'DEFAULT' | 'RISK_FOCUS' | 'ENTITY_FOCUS' | 'PATH_FOCUS';

export const GRAPH_FILTERS: { id: GraphFilter; label: string; glyph: string; description: string }[] = [
  { id: 'all', label: 'All', glyph: '◎', description: 'Every address in the traced subgraph.' },
  { id: 'known', label: 'Known', glyph: '◈', description: 'Addresses resolved to a known entity.' },
  { id: 'high-risk', label: 'High risk', glyph: '▲', description: 'Mixer and sanctioned addresses.' },
  { id: 'mixers', label: 'Mixers', glyph: '◐', description: 'Addresses labelled as mixers or tumblers.' },
  { id: 'sanctioned', label: 'Sanctioned', glyph: '⬥', description: 'Addresses on a published sanctions list.' },
  { id: 'unlabelled', label: 'Unlabelled', glyph: '○', description: 'Addresses with no resolved attribution.' },
];

export const GRAPH_MODES: { id: GraphMode; label: string; description: string }[] = [
  { id: 'DEFAULT', label: 'Default', description: 'The full subgraph at uniform emphasis.' },
  { id: 'RISK_FOCUS', label: 'Risk focus', description: 'Selected element and its risk context, everything else subdued.' },
  { id: 'ENTITY_FOCUS', label: 'Entity focus', description: 'Selected element and its immediate neighbourhood.' },
  { id: 'PATH_FOCUS', label: 'Path focus', description: 'The chain of transfers connecting the reported wallet to the selection.' },
];

/** A selection is either a node (address) or an edge (transaction). */
export type Selection =
  | { kind: 'node'; address: string }
  | { kind: 'edge'; txHash: string; from: string; to: string; id: string };

/** A request to move the viewport. `nonce` makes repeat requests observable. */
export interface FocusRequest {
  type: 'node' | 'edge';
  id: string;
  nonce: number;
}

export interface GraphNodeView {
  node: NodeDto;
  id: string;
  isRoot: boolean;
  hopDepth: number;
  labelType: LabelType | null;
  /** Capitalised entity name when the backend resolved one, else null. */
  entity: string | null;
  incoming: number;
  outgoing: number;
  volume: number;
}

export interface GraphEdgeView {
  edge: EdgeDto;
  id: string;
  source: string;
  target: string;
  fromLabel: LabelType | null;
  toLabel: LabelType | null;
  amount: number;
  transferCount: number;
  isStable: boolean;
  isOnPathRisk: boolean;
}

const STABLE_ASSETS = new Set(['USDT', 'USDC', 'DAI', 'BUSD']);

function numericAmount(value: string | number): number {
  const n = typeof value === 'number' ? value : parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

/** Stable key for an edge — mirrors the id assigned in FlowMap. */
export function edgeId(edge: EdgeDto): string {
  // We use from--to--asset for aggregation
  return `${edge.fromAddress.toLowerCase()}--${edge.toAddress.toLowerCase()}--${(edge.tokenSymbol || 'NATIVE').toUpperCase()}`;
}

/**
 * Derives a memoisable view model from a raw trace.
 *
 * Runs once per result. The Cytoscape elements, the ledger, the inspector and the
 * graph filters all read from the same derived objects, so they can never disagree
 * about how many hops a node is at or what it was labelled.
 */
export function buildGraphView(result: TraceResult) {
  const rootAddress = (result.walletAddress || '').toLowerCase();
  const nodes: GraphNodeView[] = [];
  const edges: GraphEdgeView[] = [];
  const byAddress = new Map<string, GraphNodeView>();
  const counts = new Map<string, { incoming: number; outgoing: number; volume: number }>();

  const bump = (address: string, dir: 'in' | 'out', amount: number) => {
    const key = address.toLowerCase();
    const current = counts.get(key) ?? { incoming: 0, outgoing: 0, volume: 0 };
    if (dir === 'in') current.incoming += 1;
    else current.outgoing += 1;
    current.volume += amount;
    counts.set(key, current);
  };

  for (const node of result.nodes ?? []) {
    const id = node.address.toLowerCase();
    const view: GraphNodeView = {
      node,
      id,
      isRoot: id === rootAddress,
      hopDepth: node.hopDepth ?? 0,
      labelType: node.labelType ?? null,
      entity: null,
      incoming: 0,
      outgoing: 0,
      volume: 0,
    };
    nodes.push(view);
    byAddress.set(id, view);
  }

  const aggregatedEdges = new Map<string, GraphEdgeView>();

  for (const edge of result.edges ?? []) {
    const source = edge.fromAddress.toLowerCase();
    const target = edge.toAddress.toLowerCase();
    const amount = numericAmount(edge.amount);
    const symbol = (edge.tokenSymbol || '').toUpperCase();
    const aggId = edgeId(edge);

    let view = aggregatedEdges.get(aggId);
    if (!view) {
      view = {
        edge,
        id: aggId,
        source,
        target,
        fromLabel: byAddress.get(source)?.labelType ?? null,
        toLabel: byAddress.get(target)?.labelType ?? null,
        amount: 0,
        transferCount: 0,
        isStable: STABLE_ASSETS.has(symbol),
        isOnPathRisk:
          byAddress.get(target)?.labelType === 'MIXER' || byAddress.get(target)?.labelType === 'SANCTIONED',
      };
      aggregatedEdges.set(aggId, view);
      edges.push(view);
    }
    view.amount += amount;
    view.transferCount += 1;

    bump(edge.fromAddress, 'out', amount);
    bump(edge.toAddress, 'in', amount);
  }

  for (const view of nodes) {
    const stat = counts.get(view.id);
    if (stat) {
      view.incoming = stat.incoming;
      view.outgoing = stat.outgoing;
      view.volume = stat.volume;
    }
  }

  // The nearest labelled exchange, mirroring the backend's tie-break on hop depth.
  const nearestExchange = nodes
    .filter((n) => n.labelType === 'EXCHANGE' && !n.isRoot)
    .sort((a, b) => a.hopDepth - b.hopDepth)[0] ?? null;

  return { nodes, edges, byAddress, rootAddress, nearestExchange };
}

export type GraphView = ReturnType<typeof buildGraphView>;

export function matchesFilter(view: GraphNodeView, filter: GraphFilter): boolean {
  switch (filter) {
    case 'all':
      return true;
    case 'known':
      return view.labelType === 'EXCHANGE' || view.labelType === 'MIXER' || view.labelType === 'SANCTIONED';
    case 'high-risk':
      return view.labelType === 'MIXER' || view.labelType === 'SANCTIONED';
    case 'mixers':
      return view.labelType === 'MIXER';
    case 'sanctioned':
      return view.labelType === 'SANCTIONED';
    case 'unlabelled':
      return view.labelType !== 'EXCHANGE' && view.labelType !== 'MIXER' && view.labelType !== 'SANCTIONED';
    default:
      return true;
  }
}

/**
 * Breadth-first path from the reported wallet to `targetId`, following transfer
 * direction. Used by PATH_FOCUS. Returns null when the target is not downstream of
 * the root within the traced subgraph.
 */
export function findPathTo(view: GraphView, targetId: string): string[] {
  const { rootAddress, edges } = view;
  if (!rootAddress) return [];
  if (targetId === rootAddress) return [rootAddress];

  const adjacency = new Map<string, string[]>();
  for (const e of edges) {
    const list = adjacency.get(e.source);
    if (list) list.push(e.target);
    else adjacency.set(e.source, [e.target]);
  }

  const queue: string[][] = [[rootAddress]];
  const seen = new Set<string>([rootAddress]);

  while (queue.length > 0) {
    const path = queue.shift() as string[];
    const tail = path[path.length - 1];
    const next = adjacency.get(tail);
    if (!next) continue;

    for (const candidate of next) {
      if (seen.has(candidate)) continue;
      const extended = [...path, candidate];
      if (candidate === targetId) return extended;
      seen.add(candidate);
      queue.push(extended);
    }
  }

  return [];
}

/** Node ids on a path, used to paint emphasis without touching Cytoscape internals. */
export function pathNodeSet(view: GraphView, targetId: string): Set<string> {
  return new Set(findPathTo(view, targetId));
}
