import { AlertCircle, Loader2, Search, TriangleAlert } from 'lucide-react';
import type { GraphView } from '../../lib/graph';
import { chainMeta } from '../../lib/chains';
import { STAGES, type RunState } from '../../state/investigationReducer';

/**
 * The canvas's empty states.
 *
 * Four distinct conditions, because collapsing them into one "no data" screen is how
 * an investigator ends up not knowing whether the trace failed, is still running, or
 * returned nothing. A partial trace gets its own state: an incomplete graph shown as
 * if it were complete is worse than no graph.
 */
interface Props {
  run: RunState;
  stageIndex: number;
  chain: string;
  error: string | null;
  view: GraphView | null;
}

export default function WorkspaceEmpty({ run, stageIndex, chain, error, view }: Props) {
  if (run === 'running') {
    return (
      <div className="empty-canvas">
        <span className="empty-icon">
          <Loader2 size={28} className="spin" aria-hidden />
        </span>
        <div className="empty-progress" style={{ textAlign: 'left' }}>
          <h2 className="empty-title">Tracing {chainMeta(chain).label}</h2>
          {STAGES.map((step, i) => (
            <p
              key={step.id}
              className={`progress-step${i < stageIndex ? ' progress-step--done' : i === stageIndex ? ' progress-step--active' : ''}`}
              style={{ padding: '7px 0' }}
            >
              <span className="progress-step__glyph" aria-hidden>
                {i < stageIndex ? '✓' : i === stageIndex ? <Loader2 size={10} className="spin" /> : i + 1}
              </span>
              <span style={{ fontSize: 'var(--fs-small)' }}>{step.label}</span>
            </p>
          ))}
          <p className="empty-subtext" style={{ marginTop: 10 }}>
            One request. Progress is estimated from elapsed time — the service does not
            report intermediate progress, so no percentage is invented here.
          </p>
        </div>
      </div>
    );
  }

  if (run === 'failed') {
    return (
      <div className="empty-canvas">
        <span className="empty-icon" style={{ borderColor: 'var(--risk-critical)', color: 'var(--risk-critical)' }}>
          <AlertCircle size={26} aria-hidden />
        </span>
        <div>
          <h2 className="empty-title">The trace could not complete</h2>
          <p className="empty-subtext">
            {error ?? 'The investigation service did not return a result.'}
          </p>
        </div>
      </div>
    );
  }

  if (run === 'partial') {
    return (
      <div className="empty-canvas">
        <span className="empty-icon" style={{ borderColor: 'var(--risk-high)', color: 'var(--risk-high)' }}>
          <TriangleAlert size={26} aria-hidden />
        </span>
        <div>
          <h2 className="empty-title">Partial trace</h2>
          <p className="empty-subtext">
            The service returned an incomplete graph
            {view ? ` — ${view.nodes.length} address${view.nodes.length === 1 ? '' : 'es'} and ${view.edges.length} transfer${view.edges.length === 1 ? '' : 's'}` : ''}.
            Treat the coverage as unreliable until you know which lookups failed.
          </p>
        </div>
      </div>
    );
  }

  if (view && view.nodes.length === 0) {
    return (
      <div className="empty-canvas">
        <span className="empty-icon">
          <Search size={26} aria-hidden />
        </span>
        <div>
          <h2 className="empty-title">No transfers found</h2>
          <p className="empty-subtext">
            The service traced this address and returned no transfers within the depth and
            fan-out limits. That is a result — an address with no movement in range is worth
            knowing — but there is nothing to draw.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="empty-canvas">
      <span className="empty-icon">
        <Search size={26} aria-hidden />
      </span>
      <div>
        <h2 className="empty-title">Awaiting a target</h2>
        <p className="empty-subtext">
          Enter a wallet address to trace its fund flow, resolve the entities behind it and
          score the observable risk signals.
        </p>
      </div>
    </div>
  );
}
