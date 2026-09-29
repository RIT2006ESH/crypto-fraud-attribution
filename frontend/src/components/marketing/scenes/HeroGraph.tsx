import { useMemo, useRef } from 'react';
import { motion, useInView, useReducedMotion } from 'framer-motion';
import { DEMO_EDGES, DEMO_NODES, DEMO_PATH_IDS } from '../../../lib/demo';
import { DURATION, EASE } from '../../../lib/motion';
import {
  EdgeMarkers,
  EntityNode,
  GraphEdge,
  edgeGeometry,
  nodeIndex,
  pathWaypoints,
} from './primitives';
import IllustrativeTag from '../../common/IllustrativeTag';

/**
 * HERO VISUAL — an abstract on-chain fund-flow map.
 *
 * Drawn entirely from the synthetic dataset, so nothing here can be mistaken for an
 * investigation result. The choreography is a single sequence, run once, in order:
 *
 *   1. the network fades up and rank guides draw
 *   2. edges draw outward from the reported wallet
 *   3. addresses resolve into place, rank by rank
 *   4. the highlighted investigation path draws itself
 *   5. a single pulse travels that path, then rests
 *
 * No drifting particles, no permanent loops. Once the sequence finishes the graph
 * holds, the way a finished case record holds.
 */

const VB_W = 1000;
const VB_H = 720;
const RANKS = [322, 518, 714, 892];

export default function HeroGraph() {
  const reduce = useReducedMotion();
  const wrapRef = useRef<HTMLDivElement>(null);
  const inView = useInView(wrapRef, { amount: 0.3 });

  const index = useMemo(() => nodeIndex(DEMO_NODES), []);
  const pathNodes = useMemo(
    () =>
      DEMO_PATH_IDS.map((id) => index.get(id)).filter((n): n is NonNullable<typeof n> => Boolean(n)),
    [index],
  );
  const { xs, ys } = useMemo(() => pathWaypoints(pathNodes), [pathNodes]);

  // Sibling transfers between the same pair of ranks are bowed apart.
  const siblingIndex = useMemo(() => {
    const seen = new Map<string, number>();
    return DEMO_EDGES.map((edge) => {
      const key = `${edge.from}>${edge.to}`;
      const next = seen.get(key) ?? 0;
      seen.set(key, next + 1);
      return next;
    });
  }, []);

  const pathSegments = useMemo(
    () =>
      pathNodes.slice(0, -1).map((from, i) => ({
        from,
        to: pathNodes[i + 1],
        d: edgeGeometry(from, pathNodes[i + 1], 0, 0.1).d,
      })),
    [pathNodes],
  );

  return (
    <div className="hero__graph" ref={wrapRef}>
      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Illustrative fund-flow map. A reported wallet sends funds outward through intermediary wallets to a mixer, an exchange and a sanctioned address. One path through the mixer is highlighted as the investigation path."
      >
        <EdgeMarkers idPrefix="hero" />

        {/* Rank guides — faint verticals that make the layout read as a hop map. */}
        {RANKS.map((x) => (
          <line
            key={x}
            x1={x}
            y1={40}
            x2={x}
            y2={680}
            stroke="var(--surface-hairline)"
            strokeWidth={1}
            strokeOpacity={0.55}
            strokeDasharray="2 9"
          />
        ))}

        {/* 2 — transfers. */}
        {DEMO_EDGES.map((edge, i) => {
          const from = index.get(edge.from);
          const to = index.get(edge.to);
          if (!from || !to) return null;
          return (
            <motion.g
              key={`e-${edge.from}-${edge.to}-${i}`}
              initial={reduce ? undefined : { opacity: 0 }}
              animate={reduce ? undefined : { opacity: 1 }}
              transition={{ delay: 0.3 + i * 0.05, duration: 0.55, ease: EASE.out }}
            >
              <GraphEdge
                edge={edge}
                from={from}
                to={to}
                index={siblingIndex[i]}
                showLabel={edge.onPath}
                dimmed={!edge.onPath}
                emphasised={edge.onPath}
                markerId={`hero-${edge.onPath ? 'path' : edge.rail}`}
              />
            </motion.g>
          );
        })}

        {/* 3 — addresses, rank by rank. */}
        {DEMO_NODES.map((node) => (
          <motion.g
            key={`n-${node.id}`}
            initial={reduce ? undefined : { opacity: 0 }}
            animate={reduce ? undefined : { opacity: 1 }}
            transition={{ delay: 0.6 + node.hop * 0.17, duration: DURATION.medium, ease: EASE.soft }}
          >
            <EntityNode
              node={node}
              active={node.onPath}
              dimmed={!node.onPath}
              showLabel
              showSub
              labelOffset={30}
            />
          </motion.g>
        ))}

        {/* 4 — the investigation path, redrawn on top in the brand accent. */}
        {pathSegments.map((segment, i) => (
          <motion.path
            key={`p-${segment.from.id}`}
            d={segment.d}
            fill="none"
            stroke="var(--accent-primary)"
            strokeWidth={1.4}
            strokeOpacity={0.55}
            markerEnd="url(#hero-path)"
            pointerEvents="none"
            initial={reduce ? undefined : { pathLength: 0, opacity: 0 }}
            animate={reduce ? undefined : { pathLength: 1, opacity: 1 }}
            transition={{ delay: 1.5 + i * 0.3, duration: 0.8, ease: EASE.inOut }}
          />
        ))}

        {/* 5 — one pulse, only while the hero is in view. */}
        {!reduce ? (
          <motion.circle
            r={3.2}
            style={{ fill: 'var(--accent-bright)' }}
            initial={{ cx: xs[0], cy: ys[0], opacity: 0 }}
            animate={
              inView
                ? {
                    cx: xs,
                    cy: ys,
                    opacity: [0, 1, 1, 0],
                    transition: {
                      duration: 3.6,
                      times: [0, 0.05, 0.88, 1],
                      repeat: Infinity,
                      repeatDelay: 1.2,
                      ease: EASE.inOut,
                    },
                  }
                : { cx: xs[0], cy: ys[0], opacity: 0 }
            }
            pointerEvents="none"
          />
        ) : null}
      </svg>

      <div className="hero__graph-overlay">
        <IllustrativeTag />
        <span className="hero__graph-overlay-note">4 hops · 13 addresses · 1 highlighted path</span>
      </div>
    </div>
  );
}
