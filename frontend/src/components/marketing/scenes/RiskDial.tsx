import { motion, useReducedMotion } from 'framer-motion';
import { EASE } from '../../../lib/motion';

/**
 * Risk dial.
 *
 * A 270° arc, not a full circle: a score of 100 should not look identical to a score
 * of zero, and leaving a gap makes the empty range obvious at a glance. The arc is
 * paired with the numeral beside it, so the value is never carried by arc length
 * alone.
 */

const SIZE = 132;
const R = 56;
const SWEEP = 270;
const START = 135;

function polar(angle: number, radius = R) {
  const rad = (angle * Math.PI) / 180;
  return { x: SIZE / 2 + radius * Math.cos(rad), y: SIZE / 2 + radius * Math.sin(rad) };
}

function arcPath(from: number, to: number, radius = R) {
  const a = polar(from, radius);
  const b = polar(to, radius);
  const large = to - from > 180 ? 1 : 0;
  return `M ${a.x} ${a.y} A ${radius} ${radius} 0 ${large} 1 ${b.x} ${b.y}`;
}

interface Props {
  score: number;
  color: string;
  max?: number;
  /** `sm` for the workspace rail, where the full-size dial does not fit. */
  size?: 'md' | 'sm';
}

export function RiskDial({ score, color, max = 100, size = 'md' }: Props) {
  const reduce = useReducedMotion();
  const ratio = Math.min(1, Math.max(0, score / max));
  const end = START + SWEEP * ratio;
  const box = size === 'sm' ? 78 : SIZE;

  return (
    <div className={`risk__dial${size === 'sm' ? ' risk__dial--sm' : ''}`}>
      <svg width={box} height={box} viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden>
        <path
          d={arcPath(START, START + SWEEP)}
          fill="none"
          stroke="var(--surface-hairline)"
          strokeWidth={5}
          strokeLinecap="round"
        />
        <motion.path
          d={arcPath(START, end)}
          fill="none"
          stroke={color}
          strokeWidth={5}
          strokeLinecap="round"
          initial={reduce ? undefined : { pathLength: 0 }}
          whileInView={reduce ? undefined : { pathLength: 1 }}
          viewport={{ once: true, amount: 0.6 }}
          transition={{ duration: 1.1, ease: EASE.inOut }}
        />
      </svg>

      <div className="risk__dial-value">
        <span className="risk__dial-num" style={{ color }}>
          {score}
        </span>
        <span className="risk__dial-max">/ {max}</span>
      </div>
    </div>
  );
}
