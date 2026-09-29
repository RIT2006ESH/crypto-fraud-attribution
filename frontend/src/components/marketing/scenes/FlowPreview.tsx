import { motion, useReducedMotion } from 'framer-motion';
import { DEMO_EDGES, DEMO_NODES } from '../../../lib/demo';
import { EASE } from '../../../lib/motion';
import { EdgeMarkers, EntityNode, GraphEdge, nodeIndex } from './primitives';

/**
 * Workspace schematic.
 *
 * A wireframe of the real screen: rail on the left, graph filling the middle, ledger
 * along the bottom, with the graph drawn for real inside it. Someone who has used
 * the product should recognise the layout, and someone who has not should understand
 * the arrangement from this alone.
 */

const W = 1000;
const H = 600;

/* The schematic shows a subset — enough to read as a graph, few enough to stay legible
   at this size. */
const SHOWN = DEMO_NODES.filter((n) => n.hop <= 3);

const RAIL = [
  { label: 'Target', w: 92 },
  { label: 'Chain', w: 64 },
  { label: 'Address', w: 100 },
];

const LEDGER_ROWS = 7;

export function FlowPreview({ nodeCount }: { nodeCount: number }) {
  const reduce = useReducedMotion();
  const index = nodeIndex(DEMO_NODES);

  /* Compress the demo layout into the schematic's coordinate space. */
  const scale = (node: (typeof DEMO_NODES)[number]) => ({
    ...node,
    x: 78 + (node.x / 1000) * 640,
    y: 26 + (node.y / 720) * 330,
  });

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="Schematic of the investigation workspace: a target panel on the left, a fund-flow graph in the centre, and a transfer ledger across the bottom."
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
    >
      <defs>
        <EdgeMarkers idPrefix="preview" />
      </defs>

      {/* Panel frames. */}
      <rect x={16} y={16} width={188} height={388} rx={8} fill="var(--bg-surface)" stroke="var(--surface-hairline)" />
      <rect x={218} y={16} width={766} height={388} rx={8} fill="var(--bg-surface)" stroke="var(--surface-hairline)" />
      <rect x={16} y={418} width={968} height={166} rx={8} fill="var(--bg-surface)" stroke="var(--surface-hairline)" />

      {/* Left rail: form fields. */}
      <text x={32} y={42} style={{ fontFamily: 'var(--font-mono)', fontSize: 8, fill: 'var(--text-faint)', letterSpacing: '0.16em' }}>
        TARGET
      </text>
      {RAIL.map((field, i) => (
        <g key={field.label}>
          <rect
            x={32}
            y={58 + i * 44}
            width={156}
            height={30}
            rx={5}
            fill="rgba(255,255,255,0.035)"
            stroke="var(--surface-hairline)"
          />
          <text
            x={42}
            y={77 + i * 44}
            style={{ fontFamily: 'var(--font-mono)', fontSize: 7.5, fill: 'var(--text-faint)', letterSpacing: '0.1em' }}
          >
            {field.label}
          </text>
        </g>
      ))}

      {/* Left rail: risk readout. */}
      <text x={32} y={214} style={{ fontFamily: 'var(--font-mono)', fontSize: 8, fill: 'var(--text-faint)', letterSpacing: '0.16em' }}>
        RISK
      </text>
      <text
        x={32}
        y={258}
        style={{ fontFamily: 'var(--font-mono)', fontSize: 40, fontWeight: 700, fill: 'var(--risk-critical)', letterSpacing: '-0.04em' }}
      >
        100
      </text>
      <rect x={32} y={272} width={156} height={3} rx={1.5} fill="var(--surface-hairline)" />
      <rect x={32} y={272} width={156} height={3} rx={1.5} fill="var(--risk-critical)" />
      {['Mixer', 'Sanctioned', 'Convergence'].map((label, i) => (
        <g key={label}>
          <rect x={32} y={290 + i * 26} width={156} height={20} rx={4} fill="rgba(255,255,255,0.03)" stroke="var(--surface-hairline)" />
          <text x={42} y={304 + i * 26} style={{ fontFamily: 'var(--font-sans)', fontSize: 8.5, fill: 'var(--text-secondary)' }}>
            {label}
          </text>
        </g>
      ))}

      {/* Centre: the graph. */}
      <text x={234} y={42} style={{ fontFamily: 'var(--font-mono)', fontSize: 8, fill: 'var(--text-faint)', letterSpacing: '0.16em' }}>
        FUND FLOW
      </text>
      {DEMO_EDGES.map((edge, i) => {
        const from = index.get(edge.from);
        const to = index.get(edge.to);
        if (!from || !to || from.hop > 3 || to.hop > 3) return null;
        return (
          <GraphEdge
            key={`${edge.from}-${edge.to}-${i}`}
            edge={edge}
            from={scale(from)}
            to={scale(to)}
            index={i}
            markerId={`preview-${edge.rail}`}
          />
        );
      })}
      {SHOWN.map((node, i) => (
        <motion.g
          key={node.id}
          initial={reduce ? undefined : { opacity: 0 }}
          whileInView={reduce ? undefined : { opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: reduce ? 0 : i * 0.05 }}
        >
          <EntityNode node={scale(node)} r={6} showLabel={false} />
        </motion.g>
      ))}

      {/* Bottom: the ledger. */}
      <text x={32} y={444} style={{ fontFamily: 'var(--font-mono)', fontSize: 8, fill: 'var(--text-faint)', letterSpacing: '0.16em' }}>
        TRANSFER LEDGER
      </text>
      {Array.from({ length: LEDGER_ROWS }).map((_, i) => (
        <motion.g
          key={i}
          initial={reduce ? undefined : { opacity: 0 }}
          whileInView={reduce ? undefined : { opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.3, delay: reduce ? 0 : 0.3 + i * 0.04 }}
        >
          <rect
            x={32}
            y={456 + i * 18}
            width={936}
            height={15}
            rx={3}
            fill={i === 2 ? 'rgba(76,194,255,0.08)' : 'transparent'}
            stroke="var(--surface-hairline-soft)"
          />
          <text x={42} y={467 + i * 18} style={{ fontFamily: 'var(--font-mono)', fontSize: 6.5, fill: 'var(--text-faint)' }}>
            0x{i === 0 ? '7c1d' : i === 1 ? 'b30e' : i === 2 ? 'e18c' : '2fb6'}…{i === 2 ? '  →  0x2fb6…' : '  →  0x9a26…'}
          </text>
          <text x={430} y={467 + i * 18} style={{ fontFamily: 'var(--font-mono)', fontSize: 6.5, fill: 'var(--text-muted)' }}>
            USDT
          </text>
          <text x={530} y={467 + i * 18} style={{ fontFamily: 'var(--font-mono)', fontSize: 6.5, fill: 'var(--text-faint)' }}>
            {['18,500.00', '17,900.00', '19,240.00', '980.00', '640.00', '4.20', '2.10'][i]} USDT
          </text>
          <text x={960} y={467 + i * 18} textAnchor="end" style={{ fontFamily: 'var(--font-mono)', fontSize: 6.5, fill: 'var(--text-faint)' }}>
            HOP {i < 2 ? '1' : i < 5 ? '2' : '3'}
          </text>
        </motion.g>
      ))}

      {/* A count, so the schematic does not imply a fixed graph size. */}
      <text
        x={968}
        y={444}
        textAnchor="end"
        style={{ fontFamily: 'var(--font-mono)', fontSize: 7, fill: 'var(--text-faint)', letterSpacing: '0.1em' }}
      >
        {nodeCount} ADDRESSES · 15 TRANSFERS
      </text>

      <motion.g
        initial={reduce ? undefined : { opacity: 0, x: -14 }}
        whileInView={reduce ? undefined : { opacity: 1, x: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.7, delay: 0.5, ease: EASE.out }}
      >
        <line x1={700} y1={230} x2={812} y2={270} stroke="var(--accent-primary)" strokeWidth={1} strokeDasharray="3 3" />
        <rect x={812} y={266} width={156} height={46} rx={6} fill="rgba(5,7,11,0.94)" stroke="var(--accent-line)" />
        <text x={824} y={284} style={{ fontFamily: 'var(--font-mono)', fontSize: 7.5, fill: 'var(--accent-primary)' }}>
          ENTITY INSPECTOR
        </text>
        <text x={824} y={298} style={{ fontFamily: 'var(--font-sans)', fontSize: 8, fill: 'var(--text-secondary)' }}>
          Mixer · 0.60
        </text>
      </motion.g>
    </svg>
  );
}

export default FlowPreview;
