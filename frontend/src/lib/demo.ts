import type { EntityKind } from './entities';
import { shortenAddress } from '../format';

/**
 * SYNTHETIC MARKETING DATA — NOT INVESTIGATION RESULTS.
 *
 * Everything in this file exists to draw the product story. No address, entity,
 * amount, timestamp or score here comes from a trace, and none of it may be mixed
 * into workspace views. Every component that consumes it renders a visible
 * "illustrative" marker.
 *
 * Live investigation data is only ever produced by `api.ts` and rendered by
 * `pages/Workspace.tsx`.
 */

export interface DemoNode {
  id: string;
  x: number;
  y: number;
  kind: EntityKind;
  label: string;
  sub: string;
  hop: number;
  /** Nodes on the highlighted investigation path. */
  onPath: boolean;
}

export interface DemoEdge {
  from: string;
  to: string;
  amount: string;
  asset: string;
  rail: 'native' | 'stable' | 'token';
  onPath: boolean;
}

/* ── Addresses ──────────────────────────────────────────────────────────────
   Arbitrary, deterministic 0x-shaped strings. They are formatted like real
   addresses so the interface is evaluated honestly, but they identify nothing. */

export const DEMO_ROOT = '0x9f369e2a04b7c1d55fe38ab6146ae22b83c1d479';

function addr(seed: string): string {
  return `0x${seed.repeat(2).slice(0, 40)}`;
}

const N = {
  root: DEMO_ROOT,
  a: addr('7c1d55fe'),
  b: addr('b30e91a4'),
  x: addr('51ff2a60'),
  c: addr('d47b8e13'),
  d: addr('9a26c7f5'),
  m: addr('e18c40db'),
  e: addr('2fb6705c'),
  y: addr('60d3a9e7'),
  f: addr('c85b1740'),
  g: addr('14ea62fd'),
  s: addr('8a3f0d95'),
  h: addr('3f7c81ab'),
} as const;

/* ── The traced subgraph ───────────────────────────────────────────────── */

/** `sub` is the investigator-facing second line under each node label. */
const short = (id: string) => shortenAddress(id);

export const DEMO_NODES: DemoNode[] = [
  { id: N.root, x: 128, y: 358, kind: 'target',  label: 'Reported wallet', sub: short(N.root), hop: 0, onPath: true },
  { id: N.a,    x: 322, y: 176, kind: 'wallet',      label: 'Wallet',          sub: 'HOP 1', hop: 1, onPath: false },
  { id: N.b,    x: 322, y: 358, kind: 'UNLABELED',  label: 'Unlabelled',      sub: 'HOP 1', hop: 1, onPath: true },
  { id: N.x,    x: 322, y: 546, kind: 'EXCHANGE',   label: 'Exchange / VASP', sub: 'HOP 1', hop: 1, onPath: false },
  { id: N.c,    x: 518, y: 104, kind: 'UNLABELED',  label: 'Unlabelled',      sub: 'HOP 2', hop: 2, onPath: false },
  { id: N.d,    x: 518, y: 258, kind: 'UNLABELED',  label: 'Unlabelled',      sub: 'HOP 2', hop: 2, onPath: false },
  { id: N.m,    x: 518, y: 400, kind: 'MIXER',      label: 'Mixer',           sub: 'HOP 2', hop: 2, onPath: true },
  { id: N.e,    x: 518, y: 618, kind: 'wallet',     label: 'Wallet',          sub: 'HOP 2', hop: 2, onPath: false },
  { id: N.y,    x: 714, y: 168, kind: 'EXCHANGE',   label: 'Exchange / VASP', sub: 'HOP 3', hop: 3, onPath: false },
  { id: N.f,    x: 714, y: 330, kind: 'wallet',     label: 'Wallet',          sub: 'HOP 3', hop: 3, onPath: true },
  { id: N.g,    x: 714, y: 486, kind: 'UNLABELED',  label: 'Unlabelled',      sub: 'HOP 3', hop: 3, onPath: false },
  { id: N.s,    x: 892, y: 236, kind: 'SANCTIONED', label: 'Sanctioned',      sub: 'HOP 4', hop: 4, onPath: true },
  { id: N.h,    x: 892, y: 440, kind: 'UNLABELED',  label: 'Unlabelled',      sub: 'HOP 4', hop: 4, onPath: false },
];

export const DEMO_EDGES: DemoEdge[] = [
  { from: N.root, to: N.a, amount: '4.20',  asset: 'ETH',   rail: 'native', onPath: false },
  { from: N.root, to: N.b, amount: '18,500', asset: 'USDT', rail: 'stable', onPath: true },
  { from: N.root, to: N.x, amount: '2.75',  asset: 'ETH',   rail: 'native', onPath: false },
  { from: N.a,    to: N.c, amount: '1.10',  asset: 'ETH',   rail: 'native', onPath: false },
  { from: N.a,    to: N.d, amount: '640',   asset: 'USDC',  rail: 'stable', onPath: false },
  { from: N.b,    to: N.m, amount: '17,900', asset: 'USDT', rail: 'stable', onPath: true },
  { from: N.b,    to: N.e, amount: '600',   asset: 'USDT',  rail: 'stable', onPath: false },
  { from: N.x,    to: N.m, amount: '2.10',  asset: 'ETH',   rail: 'native', onPath: false },
  { from: N.c,    to: N.y, amount: '980',   asset: 'USDC',  rail: 'stable', onPath: false },
  { from: N.d,    to: N.m, amount: '620',   asset: 'USDC',  rail: 'stable', onPath: false },
  { from: N.m,    to: N.f, amount: '19,240', asset: 'USDT', rail: 'stable', onPath: true },
  { from: N.m,    to: N.g, amount: '880',   asset: 'USDT',  rail: 'stable', onPath: false },
  { from: N.y,    to: N.s, amount: '950',   asset: 'USDC',  rail: 'stable', onPath: false },
  { from: N.f,    to: N.s, amount: '19,000', asset: 'USDT', rail: 'stable', onPath: true },
  { from: N.g,    to: N.h, amount: '870',   asset: 'USDT',  rail: 'stable', onPath: false },
];

export const DEMO_NODE_MAP = new Map(DEMO_NODES.map((n) => [n.id, n]));

/** The single path the hero and the signature scene draw as "the investigation". */
export const DEMO_PATH_IDS = [N.root, N.b, N.m, N.f, N.s];

/* ── Risk worked example ────────────────────────────────────────────────────
   Not invented for the marketing copy: these are the four patterns
   `backend/src/services/RiskScoringService.ts` would actually produce for the
   graph above, at the weights it actually publishes.

     sanctioned address reached downstream  +45   N.s at hop 4
     routed through a mixer                +45   N.m at hop 2
     cash-out point at an exchange         +15   N.x at hop 1
     funds converge on one wallet          +10   b, x, d all fund N.m
                                          ----
                                             115  → capped to 100

   The cap is shown rather than hidden: a real trace can exceed 100 on the raw
   sum, and the interface should not pretend otherwise. `layering` and
   `high-fanout` deliberately do NOT fire here — the widest split is 3 (under the
   threshold of 5) and the nearest exchange is 1 hop away (under the layering
   threshold of 3) — so they are absent from the list. */

export const DEMO_RISK_EXAMPLE = {
  score: 100,
  rawScore: 115,
  category: 'CRITICAL' as const,
  factors: [
    { ruleId: 'sanctioned-downstream', contribution: 45, evidence: '0x8a3f0d95… · hop 4' },
    { ruleId: 'mixer', contribution: 45, evidence: '0xe18c40db… · hop 2' },
    { ruleId: 'exchange-cashout', contribution: 15, evidence: '0x51ff2a60… · hop 1' },
    { ruleId: 'convergence', contribution: 10, evidence: '3 senders → 0xe18c40db…' },
  ],
  notFired: [
    { ruleId: 'high-fanout', reason: 'widest split is 3, threshold is 5' },
    { ruleId: 'layering', reason: 'nearest exchange is 1 hop away, threshold is 3' },
  ],
};

/* ── Attribution worked example ────────────────────────────────────────────
   Mirrors the four resolution steps in `backend/src/labels/LabelService.ts`,
   first hit wins. The address and entity are synthetic. */

export const DEMO_ATTRIBUTION = {
  address: DEMO_ROOT,
  entity: 'Exchange / VASP',
  entityNote: 'Resolved from the curated registry at its published confidence.',
  confidence: 95,
  source: 'Curated registry',
  pipeline: [
    { step: 'ADDRESS', value: short(DEMO_ROOT), note: 'Normalised, then chain-detected from the address format on submit.' },
    { step: 'IDENTIFIED ENTITY', value: 'Exchange / VASP', note: 'Exact address match against the curated registry.' },
    { step: 'CONFIDENCE', value: '0.95', note: 'Registry entries carry the confidence published with the listing.' },
    { step: 'SOURCE', value: 'Curated registry', note: 'Public attribution. Verify independently before relying on it.' },
  ],
};

/* ── Attribution resolution order (documentation) ──────────────────────── */

export const ATTRIBUTION_PIPELINE = [
  {
    order: '01',
    name: 'Local resolution cache',
    text: 'A previously resolved label for this address and chain, inside the cache window.',
    strength: 'As resolved previously',
  },
  {
    order: '02',
    name: 'Curated registry',
    text: 'Widely published attribution: exchange deposit addresses, mixer pools, sanctions listings.',
    strength: 'Registry confidence, typically 0.90–0.95',
  },
  {
    order: '03',
    name: 'Provider address labels',
    text: 'The data provider’s own address tagging, where the configured key has access to it.',
    strength: '0.90',
  },
  {
    order: '04',
    name: 'On-chain contract naming',
    text: 'A verified contract’s published name is matched against exchange, mixer and sanctions keywords.',
    strength: '0.60, or 0.30 when unclassified',
  },
];

/* ── Investigation pipeline (for the workflow section) ─────────────────────
   `body` is the prose shown in the rail; `detail` names the concrete artefact each
   stage produces, so the section reads as a method rather than a slogan. */

export const PIPELINE = [
  {
    num: '01',
    key: 'target',
    title: 'Submit the target',
    body: 'An address and a chain. The workspace validates the address format and resolves which network it belongs to before any request is traced.',
    detail: 'Normalised address, detected chain, target node pinned as the graph origin.',
  },
  {
    num: '02',
    key: 'trace',
    title: 'Walk the subgraph',
    body: 'The backend traverses hop by hop, collecting the native and token transfers attached to every address it reaches, up to the configured depth and fan-out.',
    detail: 'Node set, transfer set, hop depth per address, and any addresses left untraced.',
  },
  {
    num: '03',
    key: 'map',
    title: 'Map the fund flow',
    body: 'Transfers become a directed graph of addresses and value movements, laid out by hop depth so the direction of travel reads immediately.',
    detail: 'Directed graph with per-edge asset, amount, block height and confirmation count.',
  },
  {
    num: '04',
    key: 'attribute',
    title: 'Resolve the entities',
    body: 'Every address is resolved to what it actually is — exchange, mixer, sanctioned, or unlabelled — together with the source that resolved it and how confident it is.',
    detail: 'Label, confidence, and source for each address. Unresolved addresses stay unlabelled.',
  },
  {
    num: '05',
    key: 'assess',
    title: 'Score, find, report',
    body: 'Observable signals become weighted risk factors, the factors become findings, and the whole case becomes a structured report you can hand over.',
    detail: 'Risk score and category, per-factor arithmetic, findings, and an exportable report.',
  },
] as const;

/* ── Challenges (problem section) ───────────────────────────────────────── */

export const PROBLEM_CHALLENGES = [
  {
    num: '01',
    title: 'Fragmented transactions',
    body: 'A single report rarely involves a single transfer. Funds move through addresses, contracts and services that each hold a piece of the record.',
  },
  {
    num: '02',
    title: 'Unknown entities',
    body: 'Most addresses carry no identity context on their own. A wallet is a string until something resolves it to a service or a listing.',
  },
  {
    num: '03',
    title: 'Complex fund flows',
    body: 'The relevant path is buried in a wide graph. Splitting, merging and repeated hops hide the sequence an investigator actually needs to follow.',
  },
] as const;

/* ── Capability metrics (counts taken from the application architecture) ─── */

export const CAPABILITY_METRICS = [
  {
    value: 2,
    suffix: '',
    name: 'Supported chains',
    text: 'Ethereum mainnet and Tron, read through their respective public indexers.',
  },
  {
    value: 4,
    suffix: '',
    name: 'Investigation views',
    text: 'Default, risk focus, entity focus and path focus over the same graph.',
  },
  {
    value: 7,
    suffix: '',
    name: 'Risk factors',
    text: 'Weighted, named rules. Every one of them points at an observable signal in the trace.',
  },
  {
    value: 4,
    suffix: '',
    name: 'Attribution steps',
    text: 'Cache, curated registry, provider labels, on-chain contract naming. First hit wins.',
  },
] as const;

/* ── Report preview content (mirrors ReportService field-for-field) ─────── */

export const DEMO_REPORT = {
  caseId: 'CF-2041',
  traceId: 'tr_8f41c2ad9b',
  chain: 'Ethereum Mainnet',
  wallet: DEMO_ROOT,
  status: 'COMPLETED',
  hops: 4,
  addresses: 13,
  transfers: 15,
  risk: '100 / 100 — CRITICAL',
  generated: 'Generated 14 Mar 2026, 09:41 UTC',
  rows: [
    [short(N.b), short(N.m), '18,500.00 USDT'],
    [short(N.m), short(N.f), '19,240.00 USDT'],
    [short(N.f), short(N.s), '19,000.00 USDT'],
  ],
};
