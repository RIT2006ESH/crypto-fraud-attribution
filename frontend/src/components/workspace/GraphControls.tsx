import { Maximize2, Minus, Plus, RotateCcw, Scan } from 'lucide-react';
import type { GraphCanvasHandle } from './GraphCanvas';

interface Props {
  canvas: React.RefObject<GraphCanvasHandle | null>;
  zoom: number;
  fill: number;
  layoutName: string;
  onOpenDiagnostics: () => void;
}

/**
 * Graph controls.
 *
 * A vertical group rather than a row of identical buttons, so the canvas keeps its full
 * width and each control says what it does. Every icon is labelled, because an icon
 * strip with no text is a puzzle rather than a control.
 *
 * The two readouts underneath are the point of this panel existing: the investigator
 * can see that the drawing is filling the canvas and which layout strategy was chosen,
 * instead of guessing whether a sparse-looking graph is sparse or just badly framed.
 */
export default function GraphControls({ canvas, zoom, fill, layoutName, onOpenDiagnostics }: Props) {
  const pct = Math.round(zoom * 100);
  const fillPct = Math.round(fill * 100);

  return (
    <div className="graph-controls" role="group" aria-label="Graph view controls">
      <button
        type="button"
        className="ctrl-btn"
        onClick={() => canvas.current?.zoomBy(1.3)}
        aria-label="Zoom in"
        title="Zoom in"
      >
        <Plus size={15} aria-hidden />
      </button>
      <button
        type="button"
        className="ctrl-btn"
        onClick={() => canvas.current?.zoomBy(0.77)}
        aria-label="Zoom out"
        title="Zoom out"
      >
        <Minus size={15} aria-hidden />
      </button>
      <span className="ctrl-divider" aria-hidden />
      <button
        type="button"
        className="ctrl-btn ctrl-btn--primary"
        onClick={() => canvas.current?.fit()}
        aria-label="Fit investigation to canvas"
        title="Fit investigation to canvas"
      >
        <Scan size={15} aria-hidden />
      </button>
      <button
        type="button"
        className="ctrl-btn"
        onClick={() => canvas.current?.resetZoom()}
        aria-label="Reset zoom to 100%"
        title="Reset zoom to 100%"
      >
        <RotateCcw size={14} aria-hidden />
      </button>
      <button
        type="button"
        className="ctrl-btn"
        onClick={onOpenDiagnostics}
        aria-label="Show graph diagnostics"
        title="Show graph diagnostics"
      >
        <Maximize2 size={14} aria-hidden />
      </button>

      <div className="ctrl-readout" aria-live="off">
        <span className="ctrl-readout__value">{pct}%</span>
        <span className="ctrl-readout__label" title="Share of the canvas the visible graph occupies">
          {fillPct}% fill
        </span>
        <span className="ctrl-readout__strategy" title="Layout strategy chosen for this trace">
          {layoutName}
        </span>
      </div>
    </div>
  );
}
