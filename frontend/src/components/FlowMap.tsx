import { useEffect, useRef } from 'react';
import cytoscape, { type Core, type ElementDefinition } from 'cytoscape';
import dagre from 'cytoscape-dagre';
import type { TraceResult } from '../types';
import { eth, shortAddr } from '../format';

let registered = false;
if (!registered) {
  cytoscape.use(dagre);
  registered = true;
}

const COLORS: Record<string, string> = {
  EXCHANGE: '#10634a',
  MIXER: '#4a2e86',
  SANCTIONED: '#8e1b2e',
  UNLABELED: '#8496a3',
};

interface Props {
  result: TraceResult;
  onSelect: (address: string | null) => void;
}

export default function FlowMap({ result, onSelect }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);

  useEffect(() => {
    if (!host.current) return;

    const known = new Set(result.nodes.map((n) => n.address.toLowerCase()));
    const root = result.walletAddress.toLowerCase();

    const elements: ElementDefinition[] = result.nodes.map((n) => {
      const id = n.address.toLowerCase();
      const type = n.labelType ?? 'UNLABELED';
      return {
        data: { id, label: shortAddr(n.address), full: n.address, hop: n.hopDepth, type },
        classes: [type, id === root ? 'root' : ''].join(' ').trim(),
      };
    });

    // Edges can outlive their endpoints when the node cap trims the frontier.
    result.edges.forEach((e, i) => {
      const s = e.fromAddress.toLowerCase();
      const t = e.toAddress.toLowerCase();
      if (!known.has(s) || !known.has(t)) return;
      elements.push({
        data: { id: `e${i}`, source: s, target: t, label: `${eth(e.amount)} ETH` },
      });
    });

    const cy = cytoscape({
      container: host.current,
      elements,
      minZoom: 0.2,
      maxZoom: 2.5,
      style: [
        {
          selector: 'node',
          style: {
            label: 'data(label)',
            'font-family': 'IBM Plex Mono, monospace',
            'font-size': 11,
            'text-valign': 'center',
            color: '#16202b',
            shape: 'round-rectangle',
            width: 104,
            height: 34,
            'background-color': '#fdfefe',
            'border-width': 1,
            'border-color': '#9fb0bd',
          },
        },
        { selector: 'node.root', style: { 'border-width': 3, 'border-color': '#4a2e86', width: 118 } },
        {
          selector: 'node.EXCHANGE',
          style: { 'background-color': COLORS.EXCHANGE, color: '#fdfefe', 'border-color': '#0a4433', 'border-width': 2, width: 118 },
        },
        { selector: 'node.MIXER', style: { 'background-color': COLORS.MIXER, color: '#fdfefe', 'border-color': '#2f1c5c', 'border-width': 2 } },
        { selector: 'node.SANCTIONED', style: { 'background-color': COLORS.SANCTIONED, color: '#fdfefe', 'border-color': '#5d101e', 'border-width': 2 } },
        {
          selector: 'edge',
          style: {
            label: 'data(label)',
            'font-family': 'IBM Plex Mono, monospace',
            'font-size': 9,
            color: '#5a6b7a',
            'text-background-color': '#e8edf1',
            'text-background-opacity': 0.9,
            'text-background-padding': '2px',
            width: 1.4,
            'line-color': '#9fb0bd',
            'target-arrow-color': '#9fb0bd',
            'target-arrow-shape': 'triangle',
            'arrow-scale': 0.85,
            'curve-style': 'bezier',
          },
        },
        { selector: '.faded', style: { opacity: 0.18 } },
        { selector: '.picked', style: { 'border-width': 4, 'border-color': '#16202b' } },
      ],
      layout: { name: 'dagre', rankDir: 'LR', nodeSep: 26, rankSep: 96, padding: 34 } as never,
    });

    cy.on('tap', 'node', (evt) => {
      const node = evt.target;
      cy.elements().removeClass('faded picked');
      const keep = node.closedNeighborhood();
      cy.elements().difference(keep).addClass('faded');
      node.addClass('picked');
      onSelect(node.data('full'));
    });

    cy.on('tap', (evt) => {
      if (evt.target === cy) {
        cy.elements().removeClass('faded picked');
        onSelect(null);
        cy.animate({ fit: { eles: cy.elements(), padding: 34 }, duration: 220 });
      }
    });

    cy.ready(() => cy.fit(undefined, 34));
    cyRef.current = cy;

    const resize = () => cy.resize();
    window.addEventListener('resize', resize);
    return () => {
      window.removeEventListener('resize', resize);
      cy.destroy();
      cyRef.current = null;
    };
  }, [result, onSelect]);

  return <div className="graph-canvas" ref={host} />;
}
