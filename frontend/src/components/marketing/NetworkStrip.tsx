import { Boxes, GitBranch, Hexagon } from 'lucide-react';
import { useChains } from '../../hooks/useChains';
import { chainMeta } from '../../lib/chains';
import { RevealGroup, RevealItem } from '../common/Reveal';

/**
 * 02 — SUPPORTED NETWORKS
 *
 * Understated, and honest about it. The list comes from `GET /api/chains`, so only
 * chains the backend can actually trace appear. There is no "LIVE" badge here: the
 * product exposes no provider health endpoint, so claiming one would be theatre.
 */

const GLYPH = {
  ethereum: Hexagon,
  tron: Boxes,
} as const;

export default function NetworkStrip() {
  const { traceable, reachable } = useChains();

  return (
    <section className="netstrip" aria-label="Supported networks">
      <div className="container">
        <RevealGroup className="netstrip__inner" step={0.07}>
          <RevealItem className="netstrip__label" variant="fadeIn">
            Supported networks
          </RevealItem>

          <div className="netstrip__items">
            {traceable.length === 0 ? (
              <span className="netstrip__item" style={{ color: 'var(--text-faint)' }}>
                Loading chain list…
              </span>
            ) : (
              traceable.map((chain) => {
                const meta = chainMeta(chain.id);
                const Icon = GLYPH[chain.id as keyof typeof GLYPH] ?? GitBranch;
                return (
                  <RevealItem key={chain.id} className="netstrip__item" variant="fadeIn">
                    <Icon className="netstrip__glyph" aria-hidden />
                    <span>{meta.short}</span>
                    <span className="netstrip__sym">{chain.nativeSymbol}</span>
                    <span className="netstrip__sym">{meta.dataSource}</span>
                  </RevealItem>
                );
              })
            )}
          </div>

          <RevealItem className="netstrip__note" variant="fadeIn">
            {reachable
              ? 'Chain list read live from the investigation service.'
              : 'Investigation service unreachable — showing the built-in chain list.'}
          </RevealItem>
        </RevealGroup>
      </div>
    </section>
  );
}
