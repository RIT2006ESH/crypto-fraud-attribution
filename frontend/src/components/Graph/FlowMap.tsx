import { useEffect, useRef, useCallback } from "react";
import cytoscape from "cytoscape";
import dagreImport from "cytoscape-dagre";
const dagre = (dagreImport as any).default || dagreImport;
import { ZoomIn, ZoomOut, Maximize2, RotateCcw, Download } from "lucide-react";
import type { TraceResult } from "../../types";
import { shortenAddress, formatAmount } from "../../format";

cytoscape.use(dagre);

interface Props {
  result: TraceResult;
  onSelect: (address: string | null) => void;
}

/** Edge color based on transfer type — visually separates stablecoin flows from native. */
function edgeColor(transferType?: string | null): string {
  if (!transferType || transferType === "native") return "#334155"; // grey — native ETH/TRX
  const t = transferType.toLowerCase();
  // ERC-20 / TRC-20 stablecoins get amber — the dominant fraud flow, should stand out
  return t === "erc20" || t === "trc20" ? "#f59e0b" : "#3b82f6"; // amber : blue
}

export default function FlowMap({ result, onSelect }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);

  const initGraph = useCallback(() => {
    if (!containerRef.current || !result?.nodes?.length) return;

    if (cyRef.current) cyRef.current.destroy();

    const rootAddress = result.walletAddress.toLowerCase();
    const elements: cytoscape.ElementDefinition[] = [];

    // ── Nodes ────────────────────────────────────────────────────────────────
    result.nodes.forEach((n: any) => {
      const isRoot  = n.address.toLowerCase() === rootAddress;
      const type    = n.labelType || "UNLABELED";
      const short   = shortenAddress(n.address);
      // Show chain indicator in label when chain is known (Tron addresses start with T)
      const chainHint = n.address.startsWith("T") ? " [TRX]" : "";

      elements.push({
        data: {
          id:        n.address.toLowerCase(),
          label:     `${short}${chainHint}\n[${type}]`,
          address:   n.address,
          hopDepth:  n.hopDepth,
          labelType: type,
          isRoot,
        },
        classes: `${type.toLowerCase()} ${isRoot ? "root-node" : ""}`,
      });
    });

    // ── Edges ────────────────────────────────────────────────────────────────
    result.edges.forEach((e: any) => {
      const transferType = e.transferType ?? "native";
      const color        = edgeColor(transferType);
      const amtLabel     = formatAmount(e.amount, e.tokenSymbol);

      elements.push({
        data: {
          id:     `${e.fromAddress}-${e.toAddress}-${e.txHash}`,
          source: e.fromAddress.toLowerCase(),
          target: e.toAddress.toLowerCase(),
          amount: amtLabel,
          txHash: e.txHash,
          transferType,
          edgeColor: color,
        },
        classes: transferType !== "native" ? `token-edge ${transferType}` : "",
      });
    });

    const cy = cytoscape({
      container: containerRef.current,
      elements,
      style: [
        // ── Base node style ──────────────────────────────────────────────────
        {
          selector: "node",
          style: {
            label:                  "data(label)",
            "text-valign":          "bottom",
            "text-margin-y":        6,
            color:                  "#94a3b8",
            "font-size":            "10px",
            "font-family":          "JetBrains Mono, monospace",
            "text-wrap":            "wrap",
            width:                  36,
            height:                 36,
            "background-color":     "#0b111a",
            "border-width":         2,
            "border-color":         "#475569",
            "transition-property":  "border-color, border-width, background-color",
            "transition-duration":  0.2,
          },
        },
        // ── Root (reported wallet) ───────────────────────────────────────────
        {
          selector: "node.root-node",
          style: {
            "border-width":     3,
            "border-color":     "#ffffff",
            "background-color": "#1e293b",
            width:              44,
            height:             44,
          },
        },
        // ── Node types ───────────────────────────────────────────────────────
        {
          selector: "node.exchange",
          style: { "border-color": "#10b981", "background-color": "#064e3b" },
        },
        {
          selector: "node.mixer",
          style: { "border-color": "#8b5cf6", "background-color": "#4c1d95" },
        },
        {
          selector: "node.sanctioned",
          style: { "border-color": "#ef4444", "background-color": "#7f1d1d" },
        },
        {
          selector: "node:selected",
          style: { "border-color": "#06b6d4", "border-width": 4 },
        },
        // ── Base edge style ──────────────────────────────────────────────────
        {
          selector: "edge",
          style: {
            width:                2,
            "line-color":         "data(edgeColor)",
            "target-arrow-color": "data(edgeColor)",
            "target-arrow-shape": "triangle",
            "curve-style":        "bezier",
            label:                "data(amount)",
            color:                "#64748b",
            "font-size":          "9px",
            "font-family":        "JetBrains Mono, monospace",
            "text-rotation":      "autorotate",
            "text-margin-y":      -8,
          },
        },
        // ── Token/stablecoin edges — slightly bolder ─────────────────────────
        {
          selector: "edge.token-edge",
          style: {
            width:   2.5,
            color:   "#f59e0b",
          },
        },
        {
          selector: "edge.erc20",
          style: { color: "#f59e0b" },
        },
        {
          selector: "edge.trc20",
          style: { color: "#f59e0b" },
        },
        // ── Interaction states ───────────────────────────────────────────────
        {
          selector: "edge.highlighted",
          style: {
            width:                3,
            "line-color":         "#06b6d4",
            "target-arrow-color": "#06b6d4",
            color:                "#06b6d4",
          },
        },
        {
          selector: ".dimmed",
          style: { opacity: 0.2 },
        },
      ],
      layout: {
        name:             "dagre",
        rankDir:          "LR",
        nodeSep:          60,
        rankSep:          120,
        animate:          true,
        animationDuration: 500,
      } as any,
    });

    // Node click — highlight neighbourhood, dim everything else.
    cy.on("tap", "node", (evt) => {
      const node = evt.target;
      onSelect(node.data("address"));
      cy.elements().addClass("dimmed");
      node.removeClass("dimmed");
      node.neighborhood().removeClass("dimmed");
      node.connectedEdges().addClass("highlighted");
    });

    // Canvas click — reset.
    cy.on("tap", (evt) => {
      if (evt.target === cy) {
        onSelect(null);
        cy.elements().removeClass("dimmed");
        cy.edges().removeClass("highlighted");
      }
    });

    cyRef.current = cy;
    requestAnimationFrame(() => {
      cy.resize();
      cy.fit(undefined, 40);
    });
  }, [result, onSelect]);

  useEffect(() => {
    initGraph();
    return () => { if (cyRef.current) cyRef.current.destroy(); };
  }, [initGraph]);

  const handleZoomIn      = () => cyRef.current?.zoom(cyRef.current.zoom() * 1.2);
  const handleZoomOut     = () => cyRef.current?.zoom(cyRef.current.zoom() * 0.8);
  const handleFit         = () => cyRef.current?.fit(undefined, 40);
  const handleReset       = () => {
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
    const link  = document.createElement("a");
    link.download = `casetrace-graph-${result.id.slice(0, 8)}.png`;
    link.href     = png64;
    link.click();
  };

  return (
    <div className="graph-viewport">
      <div id="cytoscape-container" ref={containerRef} />

      <div className="floating-controls">
        <button type="button" className="ctrl-btn" onClick={handleZoomIn}      title="Zoom In">      <ZoomIn   size={16} /></button>
        <button type="button" className="ctrl-btn" onClick={handleZoomOut}     title="Zoom Out">     <ZoomOut  size={16} /></button>
        <button type="button" className="ctrl-btn" onClick={handleFit}         title="Fit View">     <Maximize2 size={16} /></button>
        <button type="button" className="ctrl-btn" onClick={handleReset}       title="Reset Focus">  <RotateCcw size={16} /></button>
        <button type="button" className="ctrl-btn" onClick={handleDownloadPng} title="Export Graph PNG"><Download size={16} /></button>
      </div>
    </div>
  );
}
