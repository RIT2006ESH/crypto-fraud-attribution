import { useEffect, useRef } from 'react';
import { Minus, Plus, Scan, TriangleAlert } from 'lucide-react';
import {
  GRAPH_FILTERS,
  GRAPH_MODES,
  type FocusRequest,
  type GraphFilter,
  type GraphMode,
  type GraphView,
} from '../../lib/graph';
import { LABEL_ORDER, entityMeta } from '../../lib/entities';
import type { RunState, Stage } from '../../state/investigationReducer';
import { STAGES } from '../../state/investigationReducer';
import GraphCanvas, { type GraphCanvasHandle } from './GraphCanvas';
import WorkspaceEmpty from './WorkspaceEmpty';

interface Props {
  view: GraphView | null;
  emphasis: Set<string> | null;
  highlightEdges: Set<string> | null;
  hidden: Set<string> | null;
  filter: GraphFilter;
  mode: GraphMode;
  selectedId: string | null;
  onSelect: (id: string, kind: 'node' | 'edge') => void;
  onFilter: (filter: GraphFilter) => void;
  onMode: (mode: GraphMode) => void;
  focusRequest: FocusRequest | null;
  onConsumedFocus: () => void;
  run: RunState;
  stage: Stage;
  selectedChain: string;
  error: string | null;
  hasGraph: boolean;
}

/**
 * The graph surface: toolbar above, canvas centre, controls floating over it, legend
 * beneath. The legend doubles as the filter control, because an investigator reading
 * "sanctioned" on the map should be able to isolate it without hunting for a separate
 * control.
 */
export default function GraphPanel({
  view,
  emphasis,
  highlightEdges,
  hidden,
  filter,
  mode,
  selectedId,
  onSelect,
  onFilter,
  onMode,
  focusRequest,
  onConsumedFocus,
  run,
  stage,
  selectedChain,
  error,
  hasGraph,
}: Props) {
  const canvasRef = useRef<GraphCanvasHandle>(null);

  /* Focus requests are one-shot. Cleared as soon as the canvas has seen them so a
     re-render cannot re-trigger the animation. */
  useEffect(() => {
    if (!focusRequest) return;
    onConsumedFocus();
  }, [focusRequest, onConsumedFocus]);

  const counts = countLabels(view);
  const stageIndex = STAGES.findIndex((s) => s.id === stage);

  return (
    <section className="graph-panel" aria-label="Fund-flow graph">
      <div className="canvas-toolbar-header">
        <h2 className="canvas-title">On-chain fund flow</h2>
        <div className="graph-legend" role="group" aria-label="Filter by entity type">
          {LABEL_ORDER.map((label) => {
            const meta = entityMeta(label);
            const n = counts[label] ?? 0;
            const on = filter === label.toLowerCase() || (filter === 'known' && label !== 'UNLABELED');
            return (
              <button
                key={label}
                type="button"
                className={`legend-item${on ? ' legend-item--on' : ''}`}
                onClick={() => onFilter(on && filter !== 'all' ? 'all' : (label.toLowerCase() as GraphFilter))}
                aria-pressed={on}
                title={meta.description}
              >
                <span className={`legend-swatch ${meta.glyph === '◈' ? 'exchange' : meta.glyph === '◐' ? 'mixer' : meta.glyph === '▲' ? 'sanctioned' : 'unlabelled'}`} />
                {meta.short}
                {hasGraph ? <span className="legend-count">{n}</span> : null}
              </button>
            );
          })}
        </div>
      </div>

      <div className="graph-toolbar">
        <div className="toolbar-group">
          <span className="toolbar-label">View</span>
          {GRAPH_MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              className={`chip${mode === m.id ? ' chip--on' : ''}`}
              onClick={() => onMode(m.id)}
              title={m.description}
              aria-pressed={mode === m.id}
            >
              {m.label}
            </button>
          ))}
        </div>

        <div className="toolbar-group">
          <span className="toolbar-label">Isolate</span>
          {GRAPH_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              className={`chip${filter === f.id ? ' chip--on' : ''}`}
              onClick={() => onFilter(f.id)}
              title={f.description}
              aria-pressed={filter === f.id}
            >
              <span aria-hidden style={{ opacity: 0.8 }}>{f.glyph}</span>
              {f.label}
              {hasGraph && f.id !== 'all' ? <span className="chip__count">{countsFor(view, f.id)}</span> : null}
            </button>
          ))}
        </div>

        {hidden ? (
          <span className="toolbar-label" style={{ marginLeft: 'auto' }}>
            {hidden.size} hidden
          </span>
        ) : null}
      </div>

      <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
        {hasGraph && view ? (
          <>
            <GraphCanvas
              ref={canvasRef}
              view={view}
              emphasis={emphasis}
              highlightEdges={highlightEdges}
              hidden={hidden}
              selectedId={selectedId}
              onSelect={onSelect}
              focusNonce={focusRequest?.nonce ?? 0}
              focusId={focusRequest?.id ?? null}
            />

            {hidden ? <HiddenVeil count={hidden.size} onShowAll={() => onFilter('all')} /> : null}

            {view.edges.length === 0 ? <NoTransfersNote nodeCount={view.nodes.length} /> : null}

            <div className="floating-controls">
              <button
                type="button"
                className="ctrl-btn"
                onClick={() => canvasRef.current?.zoomBy(1.25)}
                aria-label="Zoom in"
              >
                <Plus size={15} aria-hidden />
              </button>
              <button
                type="button"
                className="ctrl-btn"
                onClick={() => canvasRef.current?.zoomBy(0.8)}
                aria-label="Zoom out"
              >
                <Minus size={15} aria-hidden />
              </button>
              <button
                type="button"
                className="ctrl-btn"
                onClick={() => canvasRef.current?.fit()}
                aria-label="Fit the whole graph"
              >
                <Scan size={15} aria-hidden />
              </button>
            </div>

            <p className="graph-hint">
              {mode === 'DEFAULT'
                ? 'Click an address or a transfer to inspect it. Drag to pan, scroll to zoom.'
                : GRAPH_MODES.find((m) => m.id === mode)?.description}
            </p>
          </>
        ) : (
          <WorkspaceEmpty
            run={run}
            stageIndex={stageIndex}
            chain={selectedChain}
            error={error}
            view={view}
          />
        )}
      </div>
    </section>
  );
}

/**
 * A completed trace with no transfers. The service returned a result and the address
 * resolved, so this is a finding rather than a failure — but a canvas showing one lone
 * node with no explanation reads as a rendering bug, so it is stated outright.
 */
function NoTransfersNote({ nodeCount }: { nodeCount: number }) {
  return (
    <p className="state-banner" style={{ position: 'absolute', top: 14, left: '50%', transform: 'translateX(-50%)' }}>
      The service returned {nodeCount} address{nodeCount === 1 ? '' : 'es'} and no transfers. Nothing was
      found within the depth and fan-out limits — an absence of movement in range, not a
      complete history.
    </p>
  );
}

/** Filter chips change what is visible, so the layout has to be re-run. */
function HiddenVeil({ count, onShowAll }: { count: number; onShowAll: () => void }) {
  return (
    <div className="state-banner state-banner--warn" style={{ position: 'absolute', top: 14, left: '50%', transform: 'translateX(-50%)' }}>
      <TriangleAlert size={14} aria-hidden style={{ flexShrink: 0, marginTop: 2 }} />
      <span>
        <strong className="state-banner__title">{count} addresses hidden by the current filter</strong>
        <span style={{ display: 'block', marginTop: 3 }}>
          <button type="button" className="copy-btn" onClick={onShowAll}>
            Show all
          </button>
        </span>
      </span>
    </div>
  );
}

type LabelCounts = Record<string, number>;

function countLabels(view: GraphView | null): LabelCounts {
  const counts: LabelCounts = {};
  if (!view) return counts;
  view.nodes.forEach((n) => {
    const key = n.labelType ?? 'UNLABELED';
    counts[key] = (counts[key] ?? 0) + 1;
  });
  return counts;
}

function countsFor(view: GraphView | null, filter: GraphFilter): number {
  if (!view) return 0;
  switch (filter) {
    case 'all':
      return view.nodes.length;
    case 'known':
      return view.nodes.filter((n) => n.labelType && n.labelType !== 'UNLABELED').length;
    case 'high-risk':
      return view.nodes.filter((n) => n.labelType === 'MIXER' || n.labelType === 'SANCTIONED').length;
    case 'mixers':
      return view.nodes.filter((n) => n.labelType === 'MIXER').length;
    case 'sanctioned':
      return view.nodes.filter((n) => n.labelType === 'SANCTIONED').length;
    case 'unlabelled':
      return view.nodes.filter((n) => !n.labelType || n.labelType === 'UNLABELED').length;
    default:
      return 0;
  }
}
