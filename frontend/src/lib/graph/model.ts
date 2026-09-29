import type {
  EdgeDto,
  KeyPathDto,
  LabelType,
  NodeDto,
  TraceEntityDto,
  TraceResult,
} from '../../types';
import { displaySymbol, sanitizeSymbol } from '../symbols';

/**
 * The graph view model.
 *
 * The trace the service returns is an evidence record: one entry per transfer, no
 * hierarchy, no visual weight, and up to several hundred parallel transfers between
 * the same two addresses. Drawing that literally produces the thing an investigator
 * cannot use — twenty stacked amount labels on one edge pair, sixty identical circles,
 * and a graph squeezed into a corner of the canvas.
 *
 * So this layer derives a *view* over the evidence without discarding any of it:
 *
 *   • transfers are aggregated into logical edges (one per source/target/asset),
 *     each keeping the full list of the transactions behind it;
 *   • nodes are ranked into five importance levels so the target reads as the target;
 *   • every field is memoised on the raw result, so the derivation runs once per
 *     trace and never during a pan, a filter or a selection.
 *
 * Nothing here invents forensic meaning. Importance is derived from what the service
 * reported — hop depth, label type, transfer volume, and the key paths it flagged.
 */

/* ── Public types ─────────────────────────────────────────────────────────── */

export type GraphFilter = 'all' | 'known' | 'high-risk' | 'mixers' | 'sanctioned' | 'unlabelled';
export type GraphMode = 'DEFAULT' | 'RISK_FOCUS' | 'ENTITY_FOCUS' | 'PATH_FOCUS';

/** A selection is either a node (address) or an aggregated edge. */
export type Selection =
  | { kind: 'node'; address: string }
  | { kind: 'edge'; id: string };

/**
 * Identity of a logical connection.
 *
 * Exported so a raw transfer can be resolved back to the edge the graph drew for it.
 * The ledger shows one row per transaction, so it has to be able to walk this key in
 * reverse — keeping the definition here is what stops the two sides from drifting.
 */
export function edgeKey(
  fromAddress: string | null | undefined,
  toAddress: string | null | undefined,
  tokenSymbol: string | null | undefined,
): string {
  const source = (fromAddress || '').toLowerCase();
  const target = (toAddress || '').toLowerCase();
  const asset = (sanitizeSymbol(tokenSymbol) || 'native').toUpperCase();
  return `${source}>>${target}>>${asset}`;
}

/** A request to move the viewport. `nonce` makes repeat requests observable. */
export interface FocusRequest {
  type: 'node' | 'edge';
  id: string;
  nonce: number;
}

/**
 * Visual rank, 1 (target) to 5 (peripheral). Drives node diameter, label priority
 * and how much of the canvas a node is allowed to occupy.
 */
export type NodeTier = 1 | 2 | 3 | 4 | 5;

export interface GraphNodeView {
  node: NodeDto;
  id: string;
  isRoot: boolean;
  hopDepth: number;
  labelType: LabelType | null;
  /** Entity name, but only where the service actually supplied one. See `entityName`. */
  entityName: string | null;
  incoming: number;
  outgoing: number;
  /** Aggregated transfer count, not the edge count. */
  transferCount: number;
  /** Ranked visual importance. */
  tier: NodeTier;
  /** True when the node sits on a path the service itself flagged. */
  onKeyPath: boolean;
  /** True when the label resolves to a mixer or sanctioned address. */
  isRisk: boolean;
  /** Suggested node diameter in px, before zoom. */
  size: number;
  /** Whether the node should be labelled at a given zoom. See `labels.ts`. */
  labelPriority: number;
}

/** One logical connection, aggregating every transfer that shares source, target and asset. */
export interface GraphEdgeView {
  id: string;
  source: string;
  target: string;
  /** Every transfer behind this connection, in service order. */
  transfers: EdgeDto[];
  /** Stable key over the source/target pair, used to group in the ledger. */
  pairId: string;
  transferCount: number;
  /** Sum of amounts. Only meaningful for single-asset edges, which aggregation guarantees. */
  totalAmount: number;
  asset: string;
  /** Display form of the asset, sanitised. */
  assetLabel: string;
  isStable: boolean;
  isNative: boolean;
  /** Edge thickness class, 1–3, derived from relative value and count. */
  weight: 1 | 2 | 3;
  /** True when the edge carries a flagged pattern or terminates at a risk label. */
  isRisk: boolean;
  onKeyPath: boolean;
  /** Earliest transfer timestamp, for sorting. */
  firstSeen: string | null;
  fromLabel: LabelType | null;
  toLabel: LabelType | null;
}

/* ── Derivation ───────────────────────────────────────────────────────────── */

const STABLE_ASSETS = new Set(['USDT', 'USDC', 'DAI', 'BUSD', 'TUSD', 'FDUSD']);
const RISK_LABELS = new Set<LabelType>(['MIXER', 'SANCTIONED']);

function numericAmount(value: string | number): number {
  const n = typeof value === 'number' ? value : parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

export function isKnownLabel(label: LabelType | null): boolean {
  return label === 'EXCHANGE' || label === 'MIXER' || label === 'SANCTIONED';
}

/** Stable key for one transfer, mirroring what the ledger and inspector address. */
export function transferId(edge: EdgeDto): string {
  return `${edge.fromAddress.toLowerCase()}--${edge.toAddress.toLowerCase()}--${edge.txHash.toLowerCase()}`;
}

export function buildGraphView(result: TraceResult) {
  const rootAddress = (result.walletAddress || '').toLowerCase();

  /* The service names exactly one entity on this response: the nearest exchange. Every
     other node arrives as a label type with no name, so the graph must not pretend
     otherwise — a name is shown only where one was actually supplied. */
  const namedEntities = new Map<string, string>();
  if (result.nearestExchange?.entity) {
    namedEntities.set(result.nearestExchange.address.toLowerCase(), result.nearestExchange.entity);
  }
  const entityConfidence = new Map<string, number>();
  for (const e of result.findings?.entities ?? []) {
    const key = e.address?.toLowerCase();
    if (!key) continue;
    if (typeof e.confidence === 'number') entityConfidence.set(key, e.confidence);
  }
  if (result.nearestExchange?.address) {
    const key = result.nearestExchange.address.toLowerCase();
    if (!entityConfidence.has(key) && rootAddress === key) entityConfidence.set(key, 1);
  }

  /* Addresses on a path the service flagged. Used to emphasise, never to invent. */
  const keyPathNodes = new Set<string>();
  const keyPathPairs = new Set<string>();
  for (const path of result.findings?.keyPaths ?? collectKeyPaths(result)) {
    const addresses = path.addresses.map((a) => a.toLowerCase());
    addresses.forEach((a) => keyPathNodes.add(a));
    for (let i = 0; i < addresses.length - 1; i += 1) {
      keyPathPairs.add(`${addresses[i]}>>${addresses[i + 1]}`);
    }
  }

  const nodes: GraphNodeView[] = [];
  const byAddress = new Map<string, GraphNodeView>();

  for (const node of result.nodes ?? []) {
    const id = node.address.toLowerCase();
    const labelType = node.labelType ?? null;
    const view: GraphNodeView = {
      node,
      id,
      isRoot: id === rootAddress,
      hopDepth: node.hopDepth ?? 0,
      labelType,
      entityName: namedEntities.get(id) ?? null,
      incoming: 0,
      outgoing: 0,
      transferCount: 0,
      tier: 5,
      onKeyPath: keyPathNodes.has(id),
      isRisk: labelType !== null && RISK_LABELS.has(labelType),
      size: 18,
      labelPriority: 0,
    };
    nodes.push(view);
    byAddress.set(id, view);
  }

  /* ── Edge aggregation ─────────────────────────────────────────────────────
     Group by source, target and asset. Twenty USDT transfers between the same two
     addresses are one relationship the investigator needs to see, with twenty pieces
     of evidence behind it — not twenty lines. Assets are not merged across, because
     "12 ETH and 400 USDT" is not a quantity anyone can read. */
  const groups = new Map<string, EdgeDto[]>();
  for (const edge of result.edges ?? []) {
    const key = edgeKey(edge.fromAddress, edge.toAddress, edge.tokenSymbol);
    const bucket = groups.get(key);
    if (bucket) bucket.push(edge);
    else groups.set(key, [edge]);
  }

  const edges: GraphEdgeView[] = [];
  const transfersById = new Map<string, EdgeDto>();
  const transfersByPair = new Map<string, EdgeDto[]>();

  for (const [key, transfers] of groups) {
    const [source, target, assetKey] = key.split('>>');
    const first = transfers[0];
    const asset = first.tokenSymbol || null;
    const isNative = !asset;
    const totalAmount = transfers.reduce((sum, t) => sum + numericAmount(t.amount), 0);
    const onKeyPath = keyPathPairs.has(`${source}>>${target}`);
    const toLabel = byAddress.get(target)?.labelType ?? null;

    const view: GraphEdgeView = {
      id: key,
      source,
      target,
      transfers,
      pairId: `${source}>>${target}`,
      transferCount: transfers.length,
      totalAmount,
      asset: assetKey,
      assetLabel: isNative ? 'native' : displaySymbol(asset),
      isStable: !isNative && STABLE_ASSETS.has(assetKey),
      isNative,
      weight: 1,
      isRisk: toLabel !== null && RISK_LABELS.has(toLabel),
      onKeyPath,
      firstSeen: transfers
        .map((t) => t.txTimestamp)
        .filter((t): t is string => Boolean(t))
        .sort()[0] ?? null,
      fromLabel: byAddress.get(source)?.labelType ?? null,
      toLabel,
    };
    edges.push(view);

    for (const t of transfers) {
      transfersById.set(transferId(t), t);
    }
    const pair = transfersByPair.get(view.pairId);
    if (pair) pair.push(...transfers);
    else transfersByPair.set(view.pairId, [...transfers]);

    const from = byAddress.get(source);
    const to = byAddress.get(target);
    if (from) from.outgoing += transfers.length;
    if (to) to.incoming += transfers.length;
  }

  for (const view of nodes) {
    view.transferCount = view.incoming + view.outgoing;
  }

  /* ── Node hierarchy ───────────────────────────────────────────────────────
     The target is the one address the investigator supplied; everything else is
     ranked by how much of the evidence touches it. Hop depth is the primary signal
     because the service walks outward, so a low hop is a closer relationship. */
  const maxTransfers = Math.max(1, ...nodes.map((n) => n.transferCount));
  for (const view of nodes) {
    view.tier = rankTier(view, maxTransfers);
    view.size = sizeForTier(view.tier);
    view.labelPriority = labelPriority(view);
  }

  /* Edge thickness: relative value within this graph, not an absolute amount.
     Two decimals of a stablecoin and two wei of a memecoin are not comparable, so
     weight is a rank within the trace rather than a currency judgement. */
  const maxTotal = Math.max(1, ...edges.map((e) => e.totalAmount));
  for (const view of edges) {
    const share = view.totalAmount / maxTotal;
    const count = view.transferCount;
    view.weight = share > 0.34 || count > 12 ? 3 : share > 0.08 || count > 2 ? 2 : 1;
  }

  const nearestExchange = result.nearestExchange ?? null;

  return {
    nodes,
    edges,
    byAddress,
    rootAddress,
    nearestExchange,
    keyPaths: result.findings?.keyPaths ?? [],
    transfersById,
    transfersByPair,
    entityConfidence,
    /** Raw transfers, kept for the ledger and the export. */
    transfers: result.edges ?? [],
  };
}

export type GraphView = ReturnType<typeof buildGraphView>;

/** Defensive read: older deployments may omit `keyPaths` while still sending `nearestExchange`. */
function collectKeyPaths(result: TraceResult): KeyPathDto[] {
  const exchange = result.nearestExchange;
  if (!exchange) return [];
  return [
    {
      pathId: `path-${exchange.address}`,
      addresses: [result.walletAddress, exchange.address],
      hops: exchange.hopDepth,
      significance: 'Path to nearest cashout point',
    },
  ];
}

function rankTier(view: GraphNodeView, maxTransfers: number): NodeTier {
  if (view.isRoot) return 1;
  if (view.isRisk) return 2;
  if (view.hopDepth === 1) return 2;
  if (isKnownLabel(view.labelType)) return 3;
  if (view.hopDepth === 2) return 3;
  if (view.hopDepth === 3) return 4;
  if (view.transferCount > 0) return 4;
  return maxTransfers > 0 && view.transferCount >= maxTransfers * 0.4 ? 3 : 5;
}

function sizeForTier(tier: NodeTier): number {
  switch (tier) {
    case 1:
      return 46;
    case 2:
      return 34;
    case 3:
      return 27;
    case 4:
      return 21;
    default:
      return 17;
  }
}

/**
 * Higher wins the right to be labelled. Unlabelled peripherals sit at zero so a dense
 * graph labels its evidence rather than its noise.
 */
function labelPriority(view: GraphNodeView): number {
  if (view.isRoot) return 100;
  if (view.entityName) return 90;
  if (view.isRisk) return 80;
  if (isKnownLabel(view.labelType)) return 70;
  if (view.hopDepth <= 1) return 60;
  if (view.onKeyPath) return 50;
  if (view.hopDepth === 2) return 40;
  if (view.transferCount > 3) return 25;
  return 0;
}

/* ── Filters ──────────────────────────────────────────────────────────────── */

export function matchesFilter(view: GraphNodeView, filter: GraphFilter): boolean {
  switch (filter) {
    case 'all':
      return true;
    case 'known':
      return isKnownLabel(view.labelType);
    case 'high-risk':
    case 'mixers':
      return view.labelType === 'MIXER';
    case 'sanctioned':
      return view.labelType === 'SANCTIONED';
    case 'unlabelled':
      return !isKnownLabel(view.labelType);
    default:
      return true;
  }
}

/* ── Paths ────────────────────────────────────────────────────────────────── */

/**
 * Breadth-first path from the reported wallet to `targetId`, following transfer
 * direction. Returns null when the target is not downstream of the root.
 *
 * This is a *computed* path over the traced subgraph, and is labelled as such in the
 * interface. It is never presented as a path the service asserted — those come from
 * `findings.keyPaths` and are marked `onKeyPath` on the view.
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
      if (candidate === targetId) return [...path, candidate];
      seen.add(candidate);
      queue.push([...path, candidate]);
    }
  }

  return [];
}

export function pathNodeSet(view: GraphView, targetId: string): Set<string> {
  return new Set(findPathTo(view, targetId));
}

/** The addresses a resolved entity was reported at, for the attribution section. */
export function tracedEntities(result: TraceResult): TraceEntityDto[] {
  return result.findings?.entities ?? [];
}
