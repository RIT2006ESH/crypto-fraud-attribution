import { useEffect, useRef, useCallback } from "react";
import cytoscape from "cytoscape";
import dagreImport from "cytoscape-dagre";
const dagre = (dagreImport as any).default || dagreImport;
import { ZoomIn, ZoomOut, Maximize2, RotateCcw, Download } from "lucide-react";
import type { TraceResult } from "../types";
import { shortenAddress } from "../format";

cytoscape.use(dagre);

interface Props {
  result: TraceResult;
  onSelect: (address: string | null) => void;
}

export default function FlowMap({ result, onSelect }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);

  const initGraph = useCallback(() => {
    if (!containerRef.current || !result || !result.nodes || result.nodes.length === 0) return;

    if (cyRef.current) {
      cyRef.current.destroy();
    }

    const rootAddress = result.walletAddress.toLowerCase();

    // Map Cytoscape Elements
    const elements: cytoscape.ElementDefinition[] = [];

    // Nodes
    result.nodes.forEach((n) => {
      const isRoot = n.address.toLowerCase() === rootAddress;
      const type = n.labelType || "UNLABELED";
      const short = shortenAddress(n.address);

      elements.push({
        data: {
          id: n.address.toLowerCase(),
          label: `${short}\n[${type}]`,
          address: n.address,
          hopDepth: n.hopDepth,
          labelType: type,
          isRoot,
        },
        classes: `${type.toLowerCase()} ${isRoot ? "root-node" : ""}`,
      });
    });

    // Edges
    result.edges.forEach((e) => {
      elements.push({
        data: {
          id: `${e.fromAddress}-${e.toAddress}-${e.txHash}`,
          source: e.fromAddress.toLowerCase(),
          target: e.toAddress.toLowerCase(),
          amount: `${parseFloat(String(e.amount)).toFixed(2)} ETH`,
          txHash: e.txHash,
        },
      });
    });

    const cy = cytoscape({
      container: containerRef.current,
      elements,
      style: [
        {
          selector: "node",
          style: {
            label: "data(label)",
            "text-valign": "bottom",
            "text-margin-y": 6,
            color: "#94a3b8",
            "font-size": "10px",
            "font-family": "JetBrains Mono, monospace",
            "text-wrap": "wrap",
            width: 36,
            height: 36,
            "background-color": "#0b111a",
            "border-width": 2,
            "border-color": "#475569",
            "transition-property": "border-color, border-width, background-color",
            "transition-duration": 0.2,
          },
        },
        {
          selector: "node.root-node",
          style: {
            "border-width": 3,
            "border-color": "#ffffff",
            "background-color": "#1e293b",
            width: 44,
            height: 44,
          },
        },
        {
          selector: "node.exchange",
          style: {
            "border-color": "#10b981",
            "background-color": "#064e3b",
          },
        },
        {
          selector: "node.mixer",
          style: {
            "border-color": "#8b5cf6",
            "background-color": "#4c1d95",
          },
        },
        {
          selector: "node.sanctioned",
          style: {
            "border-color": "#ef4444",
            "background-color": "#7f1d1d",
          },
        },
        {
          selector: "node:selected",
          style: {
            "border-color": "#06b6d4",
            "border-width": 4,
          },
        },
        {
          selector: "edge",
          style: {
            width: 2,
            "line-color": "#334155",
            "target-arrow-color": "#334155",
            "target-arrow-shape": "triangle",
            "curve-style": "bezier",
            label: "data(amount)",
            color: "#64748b",
            "font-size": "9px",
            "font-family": "JetBrains Mono, monospace",
            "text-rotation": "autorotate",
            "text-margin-y": -8,
          },
        },
        {
          selector: "edge.highlighted",
          style: {
            width: 3,
            "line-color": "#06b6d4",
            "target-arrow-color": "#06b6d4",
            color: "#06b6d4",
          },
        },
        {
          selector: ".dimmed",
          style: {
            opacity: 0.25,
          },
        },
      ],
      layout: {
        name: "dagre",
        rankDir: "LR",
        nodeSep: 60,
        rankSep: 100,
        animate: true,
        animationDuration: 500,
      } as any,
    });

    // Node click handlers
    cy.on("tap", "node", (evt) => {
      const node = evt.target;
      const addr = node.data("address");
      onSelect(addr);

      // Highlight neighbors
      cy.elements().addClass("dimmed");
      node.removeClass("dimmed");
      node.neighborhood().removeClass("dimmed");
      node.connectedEdges().addClass("highlighted");
    });

    cy.on("tap", (evt) => {
      if (evt.target === cy) {
        onSelect(null);
        cy.elements().removeClass("dimmed");
        cy.edges().removeClass("highlighted");
      }
    });

    cyRef.current = cy;
  }, [result, onSelect]);

  useEffect(() => {
    initGraph();
    return () => {
      if (cyRef.current) cyRef.current.destroy();
    };
  }, [initGraph]);

  const handleZoomIn = () => cyRef.current?.zoom(cyRef.current.zoom() * 1.2);
  const handleZoomOut = () => cyRef.current?.zoom(cyRef.current.zoom() * 0.8);
  const handleFit = () => cyRef.current?.fit(undefined, 40);
  const handleReset = () => {
    onSelect(null);
    if (cyRef.current) {
      cyRef.current.elements().removeClass("dimmed");
      cyRef.current.edges().removeClass("highlighted");
      cyRef.current.fit(undefined, 40);
    }
  };

  const handleDownloadPng = () => {
    if (!cyRef.current) return;
    const png64 = cyRef.current.png({ full: true, bg: "#05070b" });
    const link = document.createElement("a");
    link.download = `casetrace-graph-${result.id.slice(0, 8)}.png`;
    link.href = png64;
    link.click();
  };

  return (
    <div className="graph-viewport">
      <div id="cytoscape-container" ref={containerRef} />

      <div className="floating-controls">
        <button type="button" className="ctrl-btn" onClick={handleZoomIn} title="Zoom In">
          <ZoomIn size={16} />
        </button>
        <button type="button" className="ctrl-btn" onClick={handleZoomOut} title="Zoom Out">
          <ZoomOut size={16} />
        </button>
        <button type="button" className="ctrl-btn" onClick={handleFit} title="Fit View">
          <Maximize2 size={16} />
        </button>
        <button type="button" className="ctrl-btn" onClick={handleReset} title="Reset Focus">
          <RotateCcw size={16} />
        </button>
        <button type="button" className="ctrl-btn" onClick={handleDownloadPng} title="Export Graph PNG">
          <Download size={16} />
        </button>
      </div>
    </div>
  );
}
