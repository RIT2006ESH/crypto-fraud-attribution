import { Boxes, Hexagon, Layers } from 'lucide-react';
import { useChains } from '../../hooks/useChains';
import { chainMeta } from '../../lib/chains';
import SectionEyebrow from '../common/SectionEyebrow';
import { Reveal, RevealGroup, RevealItem } from '../common/Reveal';

/**
 * 09 — CHAINS
 *
 * One card per chain the backend will actually trace, built from `/api/chains`. The
 * closing panel is the important one: it states that `all` aggregates the chains
 * side by side and does not follow funds between them. Overstating cross-chain
 * capability is the single easiest thing for a product like this to get wrong, so it
 * is called out explicitly rather than implied.
 */

const GLYPH = { ethereum: Hexagon, tron: Boxes } as const;

export default function ChainShowcase() {
  const { traceable } = useChains();

  return (
    <section className="section" id="chains" aria-labelledby="chains-title">
      <div className="container">
        <Reveal className="section-head">
          <SectionEyebrow index="09">Coverage</SectionEyebrow>
          <h2 id="chains-title" className="section-title">
            Two chains, read honestly.
          </h2>
          <p className="lead">
            Each chain has its own indexer, its own address format and its own asset
            registry. Coverage is stated precisely, including the parts that do not
            exist yet.
          </p>
        </Reveal>

        <RevealGroup className="chains__grid" step={0.12}>
          {traceable.map((chain) => {
            const meta = chainMeta(chain.id);
            const Icon = GLYPH[chain.id as keyof typeof GLYPH] ?? Layers;
            return (
              <RevealItem key={chain.id} className="chains__card chains__card--on">
                <div className="chains__head">
                  <Icon className="chains__glyph" aria-hidden />
                  <div>
                    <h3 className="chains__name">{meta.label}</h3>
                    <span className="chains__spec">
                      {chain.nativeSymbol} · {chain.tokens.join(' · ')}
                    </span>
                  </div>
                </div>

                <div className="chains__viz">
                  <ChainTexture id={chain.id} />
                </div>

                <div className="chains__facts">
                  {meta.facts.map((fact) => (
                    <span key={fact} className="tag">
                      {fact}
                    </span>
                  ))}
                </div>

                <p style={{ fontSize: 'var(--fs-small)', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                  {meta.notes}
                </p>
              </RevealItem>
            );
          })}
        </RevealGroup>

        <Reveal delay={0.1} className="chains__converge">
          <div>
            <h3 className="chains__converge-title">
              &ldquo;All Chains&rdquo; means side by side — not across.
            </h3>
            <p
              style={{
                marginTop: 10,
                fontSize: 'var(--fs-small)',
                color: 'var(--text-muted)',
                lineHeight: 1.62,
                maxWidth: '58ch',
              }}
            >
              Selecting every chain runs the same trace on each of them and places the
              results in one workspace. Transfers are never inferred between chains,
              because nothing on-chain establishes them.
            </p>
          </div>
          <span className="tag tag--accent">Honest by construction</span>
        </Reveal>
      </div>
    </section>
  );
}

/**
 * A tiny deterministic texture per chain. Not a logo — a pattern, so the cards feel
 * drawn from the same system as everything else rather than pasted in.
 */
function ChainTexture({ id }: { id: string }) {
  const seed = id === 'tron' ? 7 : 3;
  const cells = Array.from({ length: 42 }, (_, i) => {
    // A fixed lattice with a deterministic offset — no randomness at render time.
    const col = i % 14;
    const row = Math.floor(i / 14);
    return {
      x: 10 + col * 18 + ((row + seed) % 2) * 4,
      y: 12 + row * 34,
      on: (i * 7 + seed * 3) % 5 !== 0,
    };
  });

  return (
    <svg viewBox="0 0 260 120" preserveAspectRatio="xMidYMid slice" style={{ width: '100%', height: '100%' }} aria-hidden>
      {cells.map((cell, i) => (
        <rect
          key={i}
          x={cell.x}
          y={cell.y}
          width={11}
          height={3}
          rx={1.5}
          fill="var(--surface-hairline-strong)"
          opacity={cell.on ? 0.85 : 0.28}
        />
      ))}
    </svg>
  );
}
