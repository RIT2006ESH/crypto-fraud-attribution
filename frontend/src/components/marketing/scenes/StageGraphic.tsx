import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { DURATION, EASE } from '../../../lib/motion';
import { RISK_RULES } from '../../../lib/risk';

/**
 * WORKFLOW STAGE GRAPHIC
 *
 * One canvas, five states. Each state is a separate layer that cross-fades in as
 * its step becomes active, so the graphic accumulates rather than resets: an
 * address, then its transfers, then the mapped graph, then its labels, then the
 * risk. Drawn from the same primitives as the hero so the visual language holds.
 */

const W = 620;
const H = 520;

const P = {
  root: { x: 96, y: 258 },
  a: { x: 262, y: 118 },
  b: { x: 262, y: 258 },
  c: { x: 262, y: 398 },
  d: { x: 430, y: 158 },
  e: { x: 430, y: 300 },
  f: { x: 430, y: 434 },
} as const;

const PATH = ['M 96 258 Q 179 258 262 258', 'M 262 258 Q 346 258 430 300', 'M 430 300 L 430 434'];

const EDGES: { d: string; color: string; key: string }[] = [
  { key: 'ab', d: 'M 96 258 Q 179 188 262 118', color: 'var(--edge-native)' },
  { key: 'ad', d: 'M 96 258 Q 179 188 262 118', color: 'var(--edge-stablecoin)' },
  { key: 'ac', d: 'M 96 258 Q 179 328 262 398', color: 'var(--edge-native)' },
  { key: 'bd', d: 'M 262 258 Q 346 208 430 158', color: 'var(--edge-stablecoin)' },
  { key: 'be', d: 'M 262 258 Q 346 258 430 300', color: 'var(--accent-primary)' },
  { key: 'bf', d: 'M 262 258 Q 346 348 430 434', color: 'var(--edge-token)' },
  { key: 'cf', d: 'M 262 398 Q 346 434 430 434', color: 'var(--edge-native)' },
];

interface Props {
  /** 0-based index of the active step. */
  step: number;
}

export default function StageGraphic({ step }: Props) {
  const reduce = useReducedMotion();

  const layer = (index: number, children: React.ReactNode) => (
    <AnimatePresence initial={false}>
      {step >= index ? (
        <motion.g
          key={index}
          initial={reduce ? { opacity: 1 } : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0 }}
          transition={{ duration: DURATION.small, ease: EASE.soft }}
        >
          {children}
        </motion.g>
      ) : null}
    </AnimatePresence>
  );

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={`Pipeline stage ${step + 1} of 5: ${['target submitted', 'transfers collected', 'graph mapped', 'entities attributed', 'risk assessed'][step]}.`}
      style={{ width: '100%', height: '100%' }}
    >
      <defs>
        <marker id="stage-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
          <path d="M 0 1 L 7 4 L 0 7 z" style={{ fill: 'var(--text-faint)' }} />
        </marker>
      </defs>

      {/* Rank guides, always present — the frame the pipeline is drawn inside. */}
      {[262, 430].map((x) => (
        <line
          key={x}
          x1={x}
          y1={54}
          x2={x}
          y2={466}
          stroke="var(--surface-hairline)"
          strokeWidth={1}
          strokeDasharray="2 9"
        />
      ))}

      {/* 01 — the target. */}
      {layer(0, (
        <g>
          <motion.circle
            cx={P.root.x}
            cy={P.root.y}
            r={28}
            fill="none"
            stroke="var(--accent-line)"
            strokeWidth={1}
            initial={reduce ? undefined : { scale: 0.5, opacity: 0 }}
            animate={reduce ? undefined : { scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, ease: EASE.soft }}
            style={{ transformOrigin: `${P.root.x}px ${P.root.y}px` }}
          />
          <circle cx={P.root.x} cy={P.root.y} r={9} fill="var(--bg-surface)" stroke="var(--entity-target)" strokeWidth={2} />
          <text
            x={P.root.x}
            y={P.root.y + 46}
            textAnchor="middle"
            style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fill: 'var(--text-secondary)' }}
          >
            reported wallet
          </text>
        </g>
      ))}

      {/* 02 — the transfers leaving it. */}
      {layer(1, (
        <g>
          {EDGES.slice(0, 3).map((edge, i) => (
            <motion.path
              key={edge.key}
              d={edge.d}
              fill="none"
              stroke={edge.color}
              strokeWidth={1.2}
              strokeOpacity={0.7}
              markerEnd="url(#stage-arrow)"
              initial={reduce ? undefined : { pathLength: 0 }}
              animate={reduce ? undefined : { pathLength: 1 }}
              transition={{ duration: 0.6, delay: i * 0.12, ease: EASE.inOut }}
            />
          ))}
          {[
            { ...P.a, c: 'var(--entity-wallet)' },
            { ...P.b, c: 'var(--entity-unlabelled)' },
            { ...P.c, c: 'var(--entity-exchange)' },
          ].map((p, i) => (
            <motion.circle
              key={i}
              cx={p.x}
              cy={p.y}
              r={7}
              fill="var(--bg-surface)"
              stroke={p.c}
              strokeWidth={1.5}
              initial={reduce ? undefined : { opacity: 0, scale: 0.6 }}
              animate={reduce ? undefined : { opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, delay: 0.35 + i * 0.12, ease: EASE.soft }}
            />
          ))}
        </g>
      ))}

      {/* 03 — the full map. */}
      {layer(2, (
        <g>
          {EDGES.slice(3).map((edge, i) => (
            <motion.path
              key={edge.key}
              d={edge.d}
              fill="none"
              stroke={edge.color}
              strokeWidth={1.2}
              strokeOpacity={0.7}
              markerEnd="url(#stage-arrow)"
              initial={reduce ? undefined : { pathLength: 0 }}
              animate={reduce ? undefined : { pathLength: 1 }}
              transition={{ duration: 0.55, delay: i * 0.1, ease: EASE.inOut }}
            />
          ))}
          {[
            { ...P.d, c: 'var(--entity-unlabelled)' },
            { ...P.e, c: 'var(--entity-mixer)' },
            { ...P.f, c: 'var(--entity-unlabelled)' },
          ].map((p, i) => (
            <motion.circle
              key={i}
              cx={p.x}
              cy={p.y}
              r={7}
              fill="var(--bg-surface)"
              stroke={p.c}
              strokeWidth={1.5}
              initial={reduce ? undefined : { opacity: 0, scale: 0.6 }}
              animate={reduce ? undefined : { opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, delay: i * 0.1, ease: EASE.soft }}
            />
          ))}
        </g>
      ))}

      {/* 04 — attribution resolves onto the mapped addresses. */}
      {layer(3, (
        <g>
          {[
            { p: P.d, label: 'unlabelled' },
            { p: P.e, label: 'mixer' },
            { p: P.f, label: 'unlabelled' },
            { p: P.c, label: 'exchange' },
          ].map((item, i) => (
            <motion.text
              key={i}
              x={item.p.x}
              y={item.p.y + 24}
              textAnchor="middle"
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 9.5,
                fill:
                  item.label === 'mixer'
                    ? 'var(--entity-mixer)'
                    : item.label === 'exchange'
                      ? 'var(--entity-exchange)'
                      : 'var(--text-faint)',
                letterSpacing: '0.08em',
              }}
              initial={reduce ? undefined : { opacity: 0, y: -4 }}
              animate={reduce ? undefined : { opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
            >
              {item.label}
            </motion.text>
          ))}
          <motion.text
            x={P.e.x}
            y={P.e.y - 22}
            textAnchor="middle"
            style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fill: 'var(--accent-primary)' }}
            initial={reduce ? undefined : { opacity: 0 }}
            animate={reduce ? undefined : { opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.35 }}
          >
            0.60 confidence
          </motion.text>
        </g>
      ))}

      {/* 05 — the risk factors the resolved labels produced. */}
      {layer(4, (
        <g>
          {PATH.map((d, i) => (
            <motion.path
              key={d}
              d={d}
              fill="none"
              stroke="var(--accent-primary)"
              strokeWidth={1.4}
              strokeOpacity={0.55}
              initial={reduce ? undefined : { pathLength: 0 }}
              animate={reduce ? undefined : { pathLength: 1 }}
              transition={{ duration: 0.5, delay: i * 0.14, ease: EASE.inOut }}
            />
          ))}

          <g transform="translate(52 396)">
            <motion.text
              x={0}
              y={-12}
              style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fill: 'var(--text-faint)', letterSpacing: '0.14em' }}
              initial={reduce ? undefined : { opacity: 0 }}
              animate={reduce ? undefined : { opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.2 }}
            >
              INDICATORS THAT FIRED
            </motion.text>
            {['sanctioned-downstream', 'mixer', 'exchange-cashout', 'convergence'].map((id, i) => {
              const rule = RISK_RULES.find((r) => r.id === id);
              if (!rule) return null;
              return (
                <motion.g
                  key={rule.id}
                  initial={reduce ? undefined : { opacity: 0, x: -8 }}
                  animate={reduce ? undefined : { opacity: 1, x: 0 }}
                  transition={{ duration: 0.4, delay: 0.3 + i * 0.12 }}
                >
                  <rect x={0} y={i * 24} width={330} height={18} rx={4} fill="rgba(255,255,255,0.03)" stroke="var(--surface-hairline)" />
                  <text
                    x={10}
                    y={i * 24 + 9}
                    style={{ fontFamily: 'var(--font-sans)', fontSize: 10, fill: 'var(--text-secondary)' }}
                    dominantBaseline="middle"
                  >
                    {rule.name}
                  </text>
                  <text
                    x={320}
                    y={i * 24 + 9}
                    textAnchor="end"
                    style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fill: 'var(--risk-critical)', fontWeight: 600 }}
                    dominantBaseline="middle"
                  >
                    +{rule.weight}
                  </text>
                </motion.g>
              );
            })}
          </g>
        </g>
      ))}
    </svg>
  );
}
