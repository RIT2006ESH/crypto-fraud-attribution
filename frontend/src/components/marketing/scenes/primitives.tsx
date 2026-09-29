import type { DemoEdge, DemoNode } from '../../../lib/demo';
import { entityMeta } from '../../../lib/entities';

/**
 * Geometry and drawing primitives shared by every marketing scene.
 *
 * These are intentionally simple SVG — no graph engine, no layout library. The
 * landing page demonstrates the product; it does not reimplement it. Positions
 * come from the synthetic dataset in lib/demo.ts, so all scenes agree on where a
 * node sits and what colour its entity carries.
 */

export interface Point {
  x: number;
  y: number;
}

/** Quadratic curve between two nodes, bowed perpendicular to the run so parallel
 *  transfers between the same two ranks stay visually distinct. */
export function edgeGeometry(from: Point, to: Point, index = 0, spread = 0.16) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.hypot(dx, dy) || 1;
  // Perpendicular unit vector.
  const nx = -dy / dist;
  const ny = dx / dist;
  // Bow the curve away from the straight line, staggered per sibling edge.
  const bow = (index % 2 === 0 ? 1 : -1) * dist * spread * (1 + Math.floor(index / 2) * 0.45);
  const mx = (from.x + to.x) / 2 + nx * bow;
  const my = (from.y + to.y) / 2 + ny * bow;
  return {
    d: `M ${from.x} ${from.y} Q ${mx} ${my} ${to.x} ${to.y}`,
    mid: { x: mx / 2 + (from.x + to.x) / 4, y: my / 2 + (from.y + to.y) / 4 },
    mx,
    my,
  };
}

export const RAIL_COLOR: Record<DemoEdge['rail'], string> = {
  native: 'var(--edge-native)',
  stable: 'var(--edge-stablecoin)',
  token: 'var(--edge-token)',
};

interface EntityNodeProps {
  node: DemoNode;
  /** Radius of the main disc. */
  r?: number;
  /** Emphasised: the highlighted investigation path, or the hovered element. */
  active?: boolean;
  /** De-emphasised: present but not part of the current read. */
  dimmed?: boolean;
  showLabel?: boolean;
  showSub?: boolean;
  onHover?: (id: string | null) => void;
  labelOffset?: number;
}

export function EntityNode({
  node,
  r = 9,
  active = false,
  dimmed = false,
  showLabel = true,
  showSub = false,
  onHover,
  labelOffset = 26,
}: EntityNodeProps) {
  const meta = entityMeta(node.kind);
  const isTarget = node.kind === 'target';
  const opacity = dimmed ? 0.22 : 1;

  return (
    <g
      transform={`translate(${node.x} ${node.y})`}
      opacity={opacity}
      onPointerEnter={onHover ? () => onHover(node.id) : undefined}
      onPointerLeave={onHover ? () => onHover(null) : undefined}
      style={{ cursor: onHover ? 'pointer' : 'default' }}
    >
      {/* Halo: the "selected / on-path" read, expressed as a ring, not a glow. */}
      <circle
        r={r + (isTarget ? 10 : 8)}
        fill="none"
        stroke={meta.color}
        strokeWidth={active || isTarget ? 1.25 : 1}
        strokeOpacity={active || isTarget ? 0.5 : 0.16}
      />
      {isTarget ? (
        <circle
          r={r + 5}
          fill="none"
          stroke={meta.color}
          strokeWidth={1}
          strokeOpacity={0.28}
        />
      ) : null}

      <circle r={r} fill="var(--bg-surface)" stroke={meta.color} strokeWidth={active ? 2 : 1.5} />
      <circle r={r * 0.34} fill={meta.color} />

      {showLabel ? (
        <text
          y={labelOffset}
          textAnchor="middle"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            fill: 'var(--text-secondary)',
            letterSpacing: '0.02em',
          }}
        >
          {node.label}
        </text>
      ) : null}

      {showSub ? (
        <text
          y={labelOffset + 13}
          textAnchor="middle"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 8.5,
            fill: 'var(--text-faint)',
            letterSpacing: '0.1em',
          }}
        >
          {node.sub}
        </text>
      ) : null}

      {/* Accessible text for the whole node. */}
      <title>{`${node.label} — ${meta.label}, ${node.sub}`}</title>
    </g>
  );
}

interface EdgeProps {
  edge: DemoEdge;
  from: DemoNode;
  to: DemoNode;
  index: number;
  showLabel?: boolean;
  dimmed?: boolean;
  emphasised?: boolean;
  markerId: string;
}

export function GraphEdge({
  edge,
  from,
  to,
  index,
  showLabel = false,
  dimmed = false,
  emphasised = false,
  markerId,
}: EdgeProps) {
  const { d, mid } = edgeGeometry(from, to, index);
  const color = RAIL_COLOR[edge.rail];
  const opacity = dimmed ? 0.16 : emphasised ? 1 : 0.62;

  return (
    <g opacity={opacity}>
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={emphasised ? 1.75 : 1.25}
        strokeOpacity={emphasised ? 0.95 : 0.7}
        markerEnd={`url(#${markerId})`}
      />
      {showLabel ? (
        <text
          x={mid.x}
          y={mid.y - 4}
          textAnchor="middle"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 8.5,
            fill: emphasised ? 'var(--text-primary)' : 'var(--text-faint)',
          }}
        >
          {edge.amount} {edge.asset}
        </text>
      ) : null}
    </g>
  );
}

/** Arrow markers, one per rail colour plus the emphasised path. */
export function EdgeMarkers({ idPrefix }: { idPrefix: string }) {
  return (
    <defs>
      <marker id={`${idPrefix}-native`} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
        <path d="M 0 1 L 7 4 L 0 7 z" style={{ fill: 'var(--edge-native)' }} />
      </marker>
      <marker id={`${idPrefix}-stable`} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
        <path d="M 0 1 L 7 4 L 0 7 z" style={{ fill: 'var(--edge-stablecoin)' }} />
      </marker>
      <marker id={`${idPrefix}-token`} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
        <path d="M 0 1 L 7 4 L 0 7 z" style={{ fill: 'var(--edge-token)' }} />
      </marker>
      <marker id={`${idPrefix}-path`} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="5.5" markerHeight="5.5" orient="auto-start-reverse">
        <path d="M 0 1 L 7 4 L 0 7 z" style={{ fill: 'var(--accent-primary)' }} />
      </marker>
    </defs>
  );
}

/** Builds a lookup from node id to node for edge resolution. */
export function nodeIndex(nodes: DemoNode[]): Map<string, DemoNode> {
  return new Map(nodes.map((n) => [n.id, n]));
}

/**
 * Waypoints for the travelling pulse: the centre point of each node on the
 * highlighted path, so the dot hops the path rather than tracing its curvature.
 */
export function pathWaypoints(path: DemoNode[]): { xs: number[]; ys: number[] } {
  return {
    xs: path.map((n) => n.x),
    ys: path.map((n) => n.y),
  };
}
