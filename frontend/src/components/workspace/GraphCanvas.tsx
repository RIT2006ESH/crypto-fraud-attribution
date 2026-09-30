import { useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import cytoscape, { type Core, type ElementDefinition } from 'cytoscape';
import dagre from 'cytoscape-dagre';
import type { GraphView } from '../../lib/graph';
import { getGraphStyle } from '../../lib/graph/style';
import { useTheme } from '../../lib/theme';

cytoscape.use(dagre);

const LAYOUT = {
  name: 'dagre',
  rankDir: 'LR',
  nodeSep: 44,
  rankSep: 160,
  edgeSep: 20,
  ranker: 'network-simplex',
  animate: false,
} as const;

const layoutOptions = () => LAYOUT as unknown as cytoscape.LayoutOptions;

/** Above this many edges, amounts show on hover only so the drawing stays clean. */
const ALWAYS_SHOW_AMOUNTS_UNDER = 17;

/** Fit the visible graph, but never blow a tiny graph up to a giant one. */
function fitGraph(cy: Core) {
  cy.resize();
  const visible = cy.elements(':visible');
  if (visible.empty()) return;
  cy.fit(visible, 64);
  if (cy.zoom() > 1.5) {
    cy.zoom(1.5);
    cy.center(visible);
  }
}

function formatAmount(raw: unknown): string {
  const value = Number(raw);
  if (!Number.isFinite(value)) return String(raw ?? '');
  if (value >= 1000) return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
  if (value >= 1) return value.toLocaleString(undefined, { maximumFractionDigits: 3 });
  return value.toPrecision(3);
}

/** Log scale so 0.04 and 800 are both readable on one canvas. */
function edgeWidth(raw: unknown): number {
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return 1.8;
  return Math.min(7, Math.max(1.8, 1.8 + Math.log10(1 + value) * 1.4));
}

function shortAddress(address: string): string {
  return address.length > 14 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address;
}

export interface GraphCanvasHandle {
  relayout: () => void;
  fit: () => void;
  resetZoom: () => void;
  zoomBy: (factor: number) => void;
  focus: (id: string) => void;
}

interface Props {
  view: GraphView;
  emphasis: Set<string> | null;
  highlightEdges: Set<string> | null;
  hidden: Set<string> | null;
  selectedId: string | null;
  onSelect: (id: string, kind: 'node' | 'edge') => void;
  focusNonce: number;
  focusId: string | null;
  ref?: React.Ref<GraphCanvasHandle>;
}

export function GraphCanvas({
  view,
  emphasis,
  highlightEdges,
  hidden,
  selectedId,
  onSelect,
  focusNonce,
  focusId,
  ref,
}: Props) {
  const { theme } = useTheme();
  const mode = theme === 'dark' ? 'dark' : 'light';
  const hostRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0 && entry.contentRect.height > 0) setIsReady(true);
      }
    });
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  const onSelectRef = useRef(onSelect);
  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  const hiddenRef = useRef(hidden);
  useEffect(() => {
    hiddenRef.current = hidden;
  }, [hidden]);

  const elements = useMemo<ElementDefinition[]>(() => {
    // Total value moving through each node, used to size it.
    const flow = new Map<string, number>();
    let maxEdgeLog = 0;
    for (const e of view.edges) {
      const v = Number(e.amount);
      const safe = Number.isFinite(v) && v > 0 ? v : 0;
      flow.set(e.source, (flow.get(e.source) ?? 0) + safe);
      flow.set(e.target, (flow.get(e.target) ?? 0) + safe);
      maxEdgeLog = Math.max(maxEdgeLog, Math.log10(1 + safe));
    }
    let maxFlowLog = 0;
    flow.forEach((v) => {
      maxFlowLog = Math.max(maxFlowLog, Math.log10(1 + v));
    });
    const maxHop = Math.max(1, ...view.nodes.map((n) => n.hopDepth ?? 0));
    const showAmounts = view.edges.length < ALWAYS_SHOW_AMOUNTS_UNDER;

    const nodes: ElementDefinition[] = view.nodes.map((n) => {
      const type = n.labelType ?? 'UNLABELED';
      const named = type !== 'UNLABELED';
      const flowNorm =
        maxFlowLog > 0 ? Math.log10(1 + (flow.get(n.id) ?? 0)) / maxFlowLog : 0;
      const size = n.isRoot ? 54 : 22 + flowNorm * 26;
      const short = shortAddress(n.id);
      const prefix = n.isRoot ? 'REPORTED' : named ? type : '';
      return {
        group: 'nodes' as const,
        data: {
          id: n.id,
          label: prefix ? `${prefix}\n${short}` : short,
          address: n.id,
          hop: n.hopDepth,
          tone: Math.min(1, (n.hopDepth ?? 0) / maxHop),
          isRoot: n.isRoot,
          labelType: type,
          inDeg: n.incoming,
          outDeg: n.outgoing,
          size,
        },
        classes: [n.isRoot ? 'is-root' : '', n.outgoing === 0 && !n.isRoot ? 'is-leaf' : '']
          .filter(Boolean)
          .join(' '),
      };
    });

    const edges: ElementDefinition[] = view.edges.map((e) => {
      const v = Number(e.amount);
      const safe = Number.isFinite(v) && v > 0 ? v : 0;
      return {
        group: 'edges' as const,
        data: {
          id: e.id,
          source: e.source,
          target: e.target,
          amount: e.amount,
          asset: e.edge.tokenSymbol || '',
          stable: e.isStable,
          onRiskPath: e.isOnPathRisk,
          w: edgeWidth(e.amount),
          heat: maxEdgeLog > 0 ? Math.log10(1 + safe) / maxEdgeLog : 0,
          amountLabel: `${formatAmount(e.amount)}${e.edge.tokenSymbol ? ' ' + e.edge.tokenSymbol : ''}`,
        },
        classes: showAmounts ? 'show-amount' : '',
      };
    });

    return [...nodes, ...edges];
  }, [view]);

  const applyHidden = (cy: Core) => {
    const set = hiddenRef.current;
    cy.batch(() => {
      cy.nodes().forEach((node) => {
        node.style('display', set?.has(node.id()) ? 'none' : 'element');
      });
    });
  };

  const showTooltip = (text: string, x: number, y: number) => {
    const tip = tooltipRef.current;
    const host = hostRef.current;
    if (!tip || !host) return;
    tip.textContent = text;
    tip.style.display = 'block';
    const maxX = host.clientWidth - tip.offsetWidth - 12;
    const maxY = host.clientHeight - tip.offsetHeight - 12;
    tip.style.left = `${Math.max(8, Math.min(x + 14, maxX))}px`;
    tip.style.top = `${Math.max(8, Math.min(y + 14, maxY))}px`;
  };

  const hideTooltip = () => {
    if (tooltipRef.current) tooltipRef.current.style.display = 'none';
  };

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !isReady) return;

    const cy = cytoscape({
      container: host,
      elements,
      style: getGraphStyle(mode),
      wheelSensitivity: 0.22,
      minZoom: 0.1,
      maxZoom: 2.6,
      boxSelectionEnabled: false,
    });
    cyRef.current = cy;

    cy.on('tap', 'node', (event) => onSelectRef.current(event.target.id(), 'node'));
    cy.on('tap', 'edge', (event) => onSelectRef.current(event.target.id(), 'edge'));
    cy.on('tap', (event) => {
      if (event.target === cy) onSelectRef.current('', 'node');
    });

    const clearHover = () => {
      cy.batch(() => cy.elements().removeClass('is-faded is-hover is-hover-label'));
      hideTooltip();
      host.style.cursor = 'default';
    };

    cy.on('mouseover', 'node', (event) => {
      const node = event.target;
      const path = node.union(node.predecessors()).union(node.successors());
      cy.batch(() => {
        cy.elements().not(path).addClass('is-faded');
        path.addClass('is-hover');
        node.connectedEdges().addClass('is-hover-label');
      });
      host.style.cursor = 'pointer';
      const d = node.data();
      const rp = event.renderedPosition;
      showTooltip(
        [
          d.isRoot ? 'REPORTED WALLET' : d.labelType,
          d.address,
          `hop ${d.hop}  ·  in ${d.inDeg}  ·  out ${d.outDeg}`,
        ].join('\n'),
        rp.x,
        rp.y,
      );
    });

    cy.on('mouseover', 'edge', (event) => {
      const edge = event.target;
      const set = edge.union(edge.source()).union(edge.target());
      cy.batch(() => {
        cy.elements().not(set).addClass('is-faded');
        set.addClass('is-hover');
        edge.addClass('is-hover-label');
      });
      host.style.cursor = 'pointer';
      const d = edge.data();
      const tx = String(d.id).split('--')[2] ?? '';
      const rp = event.renderedPosition;
      showTooltip(
        [
          d.amountLabel,
          `from ${shortAddress(d.source)}`,
          `to   ${shortAddress(d.target)}`,
          tx ? `tx   ${shortAddress(tx)}` : '',
        ]
          .filter(Boolean)
          .join('\n'),
        rp.x,
        rp.y,
      );
    });

    cy.on('mouseout', 'node, edge', clearHover);
    cy.on('pan zoom drag', hideTooltip);

    applyHidden(cy);
    const layout = cy.elements(':visible').layout(layoutOptions());
    layout.on('layoutstop', () => fitGraph(cy));
    layout.run();

    // Re-fit when the panel changes size, until the investigator pans or zooms themselves.
    let userMoved = false;
    const markMoved = () => {
      userMoved = true;
    };
    host.addEventListener('wheel', markMoved, { once: true, passive: true });
    host.addEventListener('pointerdown', markMoved, { once: true });

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
          cy.resize();
          if (!userMoved) fitGraph(cy);
        }
      }
    });
    resizeObserver.observe(host);

    return () => {
      resizeObserver.disconnect();
      cy.destroy();
      cyRef.current = null;
    };
    // Theme is applied by the effect below so a toggle doesn't rebuild the graph.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elements, isReady]);

  useEffect(() => {
    cyRef.current?.style().fromJson(getGraphStyle(mode)).update();
  }, [mode]);

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;

    cy.batch(() => {
      cy.elements().removeClass('is-dimmed is-on-path is-selected');

      if (emphasis && emphasis.size > 0) {
        cy.nodes().forEach((node) => {
          if (!emphasis.has(node.id())) node.addClass('is-dimmed');
        });
        cy.edges().forEach((edge) => {
          if (!emphasis.has(edge.source().id()) || !emphasis.has(edge.target().id())) {
            edge.addClass('is-dimmed');
          }
        });
      }

      highlightEdges?.forEach((id) => {
        const edge = cy.getElementById(id);
        if (edge.nonempty()) edge.addClass('is-on-path');
      });

      if (selectedId) {
        const element = cy.getElementById(selectedId);
        if (element.nonempty()) element.addClass('is-selected');
      }
    });
  }, [emphasis, highlightEdges, selectedId]);

  /* Filtering hides nodes rather than removing them so pan and zoom survive, then
     re-lays-out only what is still visible so no hole is left in a dagre rank. */
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    applyHidden(cy);
    const layout = cy.elements(':visible').layout(layoutOptions());
    layout.on('layoutstop', () => fitGraph(cy));
    layout.run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hidden]);

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy || !focusId || focusNonce === 0) return;
    const element = cy.getElementById(focusId);
    if (element.empty()) return;
    cy.animate({ fit: { eles: element, padding: 190 }, duration: 340 });
  }, [focusId, focusNonce]);

  useImperativeHandle(
    ref,
    () => ({
      relayout: () => {
        const cy = cyRef.current;
        if (!cy) return;
        const layout = cy.elements(':visible').layout(layoutOptions());
        layout.on('layoutstop', () => fitGraph(cy));
        layout.run();
      },
      fit: () => {
        const cy = cyRef.current;
        if (cy) {
          cy.resize();
          cy.animate({ fit: { eles: cy.elements(':visible'), padding: 64 }, duration: 300 });
        }
      },
      resetZoom: () => {
        const cy = cyRef.current;
        if (cy) {
          cy.resize();
          cy.animate({ fit: { eles: cy.elements(':visible'), padding: 64 }, duration: 300 });
        }
      },
      zoomBy: (factor) => {
        const cy = cyRef.current;
        if (!cy) return;
        const next = Math.min(cy.maxZoom(), Math.max(cy.minZoom(), cy.zoom() * factor));
        cy.animate({ zoom: next, duration: 160 });
      },
      focus: (id) => {
        const cy = cyRef.current;
        const element = cy?.getElementById(id);
        if (cy && element?.nonempty()) cy.animate({ center: { eles: element }, duration: 320 });
      },
    }),
    [],
  );

  const dark = mode === 'dark';

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: 0, overflow: 'hidden' }}>
      <div className="graph-viewport" ref={hostRef} style={{ width: '100%', height: '100%' }} />
      {/* Soft ambient glow behind the graph; never intercepts the mouse. */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          background: dark
            ? 'radial-gradient(ellipse 60% 55% at 35% 50%, rgba(124,196,255,0.07), transparent 70%)'
            : 'radial-gradient(ellipse 60% 55% at 35% 50%, rgba(37,99,235,0.06), transparent 70%)',
        }}
      />
      <div
        ref={tooltipRef}
        style={{
          display: 'none',
          position: 'absolute',
          pointerEvents: 'none',
          zIndex: 5,
          whiteSpace: 'pre',
          padding: '8px 10px',
          borderRadius: 8,
          fontSize: 11,
          lineHeight: 1.5,
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
          background: dark ? 'rgba(13,17,26,0.96)' : 'rgba(255,255,255,0.97)',
          color: dark ? '#dbe4f3' : '#1b2433',
          border: `1px solid ${dark ? '#26324a' : '#d5dceb'}`,
          boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
        }}
      />
    </div>
  );
}

export default GraphCanvas;