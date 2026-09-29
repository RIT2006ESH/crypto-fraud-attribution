import { useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { CornerDownRight } from 'lucide-react';
import { DEMO_EDGES, DEMO_NODES, DEMO_ROOT } from '../../lib/demo';
import { entityMeta } from '../../lib/entities';
import { shortenAddress } from '../../format';
import SectionEyebrow from '../common/SectionEyebrow';
import { Reveal } from '../common/Reveal';
import { EdgeMarkers, EntityNode, GraphEdge, nodeIndex } from './scenes/primitives';

/**
 * 06 — FUND FLOW
 *
 * An interactive read of the graph: hover an address and its immediate
 * counterparties light up while the rest recede. It is a plain SVG built from the
 * shared primitives, deliberately not the Cytoscape workspace renderer — this is a
 * demonstration, and pulling the full engine onto the marketing page would ship
 * weight the page does not earn.
 */

const VB_W = 1000;
const VB_H = 860;

export default function FundFlowSection() {
  const reduce = useReducedMotion();
  const [hover, setHover] = useState<string | null>(null);

  const index = useMemo(() => nodeIndex(DEMO_NODES), []);

  // Direct neighbours only: hovering reveals the address's own transfers, not the
  // whole transitive closure, which would light up most of the graph.
  const neighbourhood = useMemo(() => {
    if (!hover) return null;
    const set = new Set<string>([hover]);
    DEMO_EDGES.forEach((edge) => {
      if (edge.from === hover) set.add(edge.to);
      if (edge.to === hover) set.add(edge.from);
    });
    return set;
  }, [hover]);

  const hoveredEdge = useMemo(() => {
    if (!hover) return null;
    const from = index.get(hover);
    const out = DEMO_EDGES.filter((e) => e.from === hover && index.get(e.to));
    const inbound = DEMO_EDGES.filter((e) => e.to === hover && index.get(e.from));
    return { from, out, inbound };
  }, [hover, index]);

  return (
    <section className="section" id="fund-flow" aria-labelledby="flowmap-title">
      <div className="container flowmap__layout">
        <Reveal>
          <SectionEyebrow index="06">Fund flow</SectionEyebrow>
          <h2 id="flowmap-title" className="section-title">
            The map answers the first question immediately.
          </h2>
          <p className="lead">
            Not a diagram of everything — a map of what moved, in which direction, in
            what asset, and over how many hops. Layout runs by hop depth, so distance
            from the reported wallet is legible before you read a single label.
          </p>

          <div className="flowmap__legend" style={{ marginTop: 28 }}>
            {DEMO_NODES.filter((n) => n.kind !== 'wallet').map((kind) => {
              const meta = entityMeta(kind.kind);
              return (
                <span key={kind.id} className="flowmap__legend-item">
                  <span className={`flowmap__legend-swatch flowmap__legend-swatch--${kind.kind.toLowerCase()}`} style={{ color: meta.color }} />
                  {meta.label}
                </span>
              );
            })}
          </div>
        </Reveal>

        <Reveal delay={0.1} className="flowmap__stage">
          <div className="flowmap__canvas">
            <svg
              viewBox={`0 0 ${VB_W} ${VB_H}`}
              preserveAspectRatio="xMidYMid meet"
              role="img"
              aria-label="Illustrative fund-flow map of 13 addresses across four hops. The reported wallet is on the left and funds move left to right."
            >
              <EdgeMarkers idPrefix="flowmap" />

              {DEMO_EDGES.map((edge, i) => {
                const from = index.get(edge.from);
                const to = index.get(edge.to);
                if (!from || !to) return null;
                const lit =
                  !neighbourhood || (neighbourhood.has(edge.from) && neighbourhood.has(edge.to));
                return (
                  <g key={`${edge.from}-${edge.to}-${i}`} opacity={lit ? 1 : 0.12}>
                    <GraphEdge
                      edge={edge}
                      from={from}
                      to={to}
                      index={i}
                      markerId={`flowmap-${edge.rail}`}
                      emphasised={Boolean(hover) && lit}
                    />
                  </g>
                );
              })}

              {DEMO_NODES.map((node) => (
                <EntityNode
                  key={node.id}
                  node={node}
                  dimmed={neighbourhood !== null && !neighbourhood.has(node.id)}
                  onHover={setHover}
                  showLabel={!reduce}
                  showSub={!reduce}
                />
              ))}
            </svg>
          </div>

          <div className="flowmap__meta">
            <motion.div
              className="flowmap__meta-card"
              animate={{ opacity: hoveredEdge ? 1 : 0.94 }}
              transition={{ duration: 0.25 }}
            >
              {hoveredEdge?.from ? (
                <>
                  <span className="flowmap__legend-item">
                    <span className="flowmap__legend-swatch flowmap__legend-swatch--target" />
                    {hoveredEdge.from.label}
                  </span>
                  <strong style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-meta)' }}>
                    {shortenAddress(hoveredEdge.from.id)}
                  </strong>
                  <span style={{ fontSize: 'var(--fs-meta)', color: 'var(--text-faint)' }}>
                    {hoveredEdge.out.length} out · {hoveredEdge.inbound.length} in
                  </span>
                </>
              ) : (
                <>
                  <span className="flowmap__legend-item">
                    <span className="flowmap__legend-swatch flowmap__legend-swatch--target" />
                    Reported wallet
                  </span>
                  <strong style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-meta)' }}>
                    {shortenAddress(DEMO_ROOT)}
                  </strong>
                  <span style={{ fontSize: 'var(--fs-meta)', color: 'var(--text-faint)' }}>
                    Hover any address to isolate its transfers
                  </span>
                </>
              )}
            </motion.div>

            <div className="flowmap__legend">
              <span className="flowmap__legend-item">
                <CornerDownRight size={12} aria-hidden />
                {DEMO_EDGES.length} transfers
              </span>
              <span className="flowmap__legend-item">4 hops</span>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
