import { useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import cytoscape, { type Core, type ElementDefinition } from 'cytoscape';
// Registers the `dagre` layout name with Cytoscape. Its options are not part of
// Cytoscape's own LayoutOptions union, so the layout object below is declared
// separately and cast at the call sites.
import dagre from 'cytoscape-dagre';
import type { GraphView } from '../../lib/graph';
import { getGraphStyle } from '../../lib/graph/style';
import { useTheme } from '../../lib/theme';

// Registers the `dagre` layout name on the Cytoscape build we imported above. Without
// this, `layout: { name: 'dagre' }` throws at runtime.
cytoscape.use(dagre);

/**
 * The graph canvas.
 *
 * Cytoscape owns the element collection, the layout and the viewport; React owns
 * neither. The component is handed a derived view, an emphasis set and a selection,
 * and applies them as style classes — so React can re-render at any time without
 * disturbing the pan and zoom the investigator has set up.
 *
 * Element ids are fixed here and mirrored by `edgeId` in `lib/graph.ts`:
 *
 *   node  the lowercased address
 *   edge  from--to--txhash
 */

/** `cytoscape-dagre` does not augment Cytoscape's layout option types, so the one
 *  cast lives here rather than being repeated at each call site. */
const layoutOptions = () => LAYOUT as unknown as cytoscape.LayoutOptions;

const LAYOUT = {
  name: 'dagre',
  rankDir: 'LR',
  nodeSep: 60,
  rankSep: 200,
  edgeSep: 30,
  ranker: 'network-simplex',
  animate: false,
} as const;

export interface GraphCanvasHandle {
  /** Re-run the layout, e.g. after a filter changes what is visible. */
  relayout: () => void;
  /** Fit the whole graph. */
  fit: () => void;
  /** Zoom by a multiplier, clamped to the configured range. */
  zoomBy: (factor: number) => void;
  /** Centre a single element. */
  focus: (id: string) => void;
}

interface Props {
  view: GraphView;
  /** Node ids to emphasise. Everything else is subdued. `null` means no emphasis. */
  emphasis: Set<string> | null;
  /** Edge ids to draw in the accent colour. */
  highlightEdges: Set<string> | null;
  /** Node ids the active filter has removed from the drawing. */
  hidden: Set<string> | null;
  selectedId: string | null;
  onSelect: (id: string, kind: 'node' | 'edge') => void;
  /**
   * Increments whenever a new focus is requested. Because it changes even when the
   * same element is requested twice, the effect below re-runs for repeat requests.
   */
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
  const hostRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
          setIsReady(true);
        }
      }
    });

    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  /* Keeping the latest callback in a ref means the Cytoscape instance is created once
     per trace rather than once per parent render. Written in an effect rather than
     during render so the ref is never read as part of rendering. */
  const onSelectRef = useRef(onSelect);
  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  const elements = useMemo<ElementDefinition[]>(() => {
    const nodes: ElementDefinition[] = view.nodes.map((n) => ({
      group: 'nodes' as const,
      data: {
        id: n.id,
        // Only labelled entities get a visible label. Printing "UNLABELED" on every
        // unlabelled address turns the graph into a wall of noise.
        label: n.labelType && n.labelType !== 'UNLABELED' ? n.labelType.toLowerCase() : '',
        address: n.id,
        hop: n.hopDepth,
        isRoot: n.isRoot,
        labelType: n.labelType ?? 'UNLABELED',
        inDeg: n.incoming,
        outDeg: n.outgoing,
      },
    }));

    const edges: ElementDefinition[] = view.edges.map((e) => ({
      group: 'edges' as const,
      data: {
        id: e.id,
        source: e.source,
        target: e.target,
        amount: e.amount,
        asset: e.edge.tokenSymbol || '',
        stable: e.isStable,
        onRiskPath: e.isOnPathRisk,
      },
    }));

    return [...nodes, ...edges];
  }, [view]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !isReady) return;

    const cy = cytoscape({
      container: host,
      elements,
      style: getGraphStyle(theme === 'dark' ? 'dark' : 'light'),
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

    let layoutCompleted = false;

    // The layout is run manually so we can wait for layoutstop before fitting
    const layout = cy.layout(layoutOptions());
    layout.on('layoutstop', () => {
      layoutCompleted = true;
      cy.resize();
      // Calculate responsive padding
      const pad = Math.min(Math.max(40, host.clientWidth * 0.05), 100);
      cy.fit(undefined, pad);
    });
    layout.run();

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
          cy.resize();
        }
      }
    });
    resizeObserver.observe(host);

    return () => {
      resizeObserver.disconnect();
      cy.destroy();
      cyRef.current = null;
    };
  }, [elements, isReady]); // Intentionally not depending on theme here so we don't recreate the graph on theme toggle

  // Update Cytoscape style when theme changes without destroying the graph
  useEffect(() => {
    if (cyRef.current) {
      cyRef.current.style().fromJson(getGraphStyle(theme === 'dark' ? 'dark' : 'light')).update();
    }
  }, [theme]);

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

  /**
   * Filtering is expressed as `display: none` rather than by removing elements, so the
   * investigator's pan and zoom survive a filter change. The layout is re-run because
   * hiding a node in the middle of a dagre rank otherwise leaves a hole in the drawing.
   */
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    cy.batch(() => {
      cy.nodes().forEach((node) => {
        node.style('display', hidden?.has(node.id()) ? 'none' : 'element');
      });
    });
    const layout = cy.layout(layoutOptions());
    layout.on('layoutstop', () => {
      cy.resize();
      const pad = Math.min(Math.max(40, hostRef.current?.clientWidth! * 0.05), 100);
      cy.fit(undefined, pad);
    });
    layout.run();
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
      relayout: () => cyRef.current?.layout(layoutOptions()).run(),
      fit: () => {
        const cy = cyRef.current;
        if (cy) cy.animate({ fit: { eles: cy.elements(), padding: 48 }, duration: 300 });
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

  return <div className="graph-viewport" ref={hostRef} />;
}

export default GraphCanvas;
