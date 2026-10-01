<<<<<<< HEAD
import type { Stylesheet } from 'cytoscape';

export const getGraphStyle = (theme: 'light' | 'dark'): Stylesheet[] => {
  const isDark = theme === 'dark';

  const colors = {
    canvas: isDark ? '#05070b' : '#f4f6f8',
    grid: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(15, 23, 42, 0.05)',
    nodeFill: isDark ? '#111827' : '#ffffff',
    nodeBorder: isDark ? '#334155' : '#94a3b8',
    nodeLabel: isDark ? '#cbd5e1' : '#334155',
    nodeTarget: isDark ? '#f8fafc' : '#0f172a',
    edge: isDark ? '#475569' : '#64748b',
    edgeActive: isDark ? '#3b82f6' : '#2563eb',
    selection: isDark ? '#06b6d4' : '#2563eb',
    
    // Entities
    exchange: '#059669', // Works for both, adjust if needed
    mixer: '#7c3aed',
    sanctioned: '#dc2626',
    unlabelled: isDark ? '#64748b' : '#64748b',
    
    // Edges
    native: isDark ? '#475569' : '#94a3b8',
    stablecoin: isDark ? '#f59e0b' : '#d97706',
    token: isDark ? '#3b82f6' : '#2563eb',
  };

  return [
    {
      selector: 'node',
      style: {
        'background-color': colors.nodeFill,
        'border-width': 2,
        'border-color': colors.nodeBorder,
        label: 'data(label)',
        color: colors.nodeLabel,
        'text-valign': 'bottom',
        'text-halign': 'center',
        'text-margin-y': 6,
        'font-size': 10,
        'font-family': 'Inter, sans-serif',
        shape: 'round-rectangle',
        width: 48,
        height: 48,
      },
    },
    {
      selector: 'node[type = "EXCHANGE"]',
      style: {
        'border-color': colors.exchange,
        'border-width': 3,
      },
    },
    {
      selector: 'node[type = "MIXER"]',
      style: {
        'border-color': colors.mixer,
        'border-width': 3,
      },
    },
    {
      selector: 'node[type = "SANCTIONED"]',
      style: {
        'border-color': colors.sanctioned,
        'border-width': 3,
      },
    },
    {
      selector: 'node.is-selected',
      style: {
        'border-color': colors.selection,
        'border-width': 4,
        'box-shadow': `0 0 10px ${colors.selection}`, // Cy doesn't directly support CSS box-shadow, but conceptually
        'underlay-color': colors.selection,
        'underlay-padding': 4,
        'underlay-opacity': 0.3,
      },
    },
    {
      selector: 'edge',
      style: {
        'width': 2,
        'line-color': colors.native,
        'target-arrow-color': colors.native,
        'target-arrow-shape': 'triangle',
        'curve-style': 'bezier',
        'arrow-scale': 1.2,
      },
    },
    {
      selector: 'edge[assetType = "ERC20"]',
      style: {
        'line-color': colors.token,
        'target-arrow-color': colors.token,
      },
    },
    {
      selector: 'edge[assetType = "STABLECOIN"]',
      style: {
        'line-color': colors.stablecoin,
        'target-arrow-color': colors.stablecoin,
=======
import type cytoscape from 'cytoscape';

type Mode = 'dark' | 'light';

const PALETTE = {
  dark: {
    hopNear: '#67e8f9',
    hopFar: '#818cf8',
    exchange: '#4ade80',
    mixer: '#a78bfa',
    sanctioned: '#f87171',
    root: '#7cc4ff',
    nodeBorder: '#0b0f17',
    edgeLow: '#334155',
    edgeHigh: '#38bdf8',
    edgeHi: '#7cc4ff',
    risk: '#f87171',
    text: '#c9d4e8',
    textMuted: '#7f8ca6',
    labelBg: '#0b0f17',
  },
  light: {
    hopNear: '#0891b2',
    hopFar: '#4f46e5',
    exchange: '#16a34a',
    mixer: '#7c3aed',
    sanctioned: '#dc2626',
    root: '#2563eb',
    nodeBorder: '#ffffff',
    edgeLow: '#b6c2d6',
    edgeHigh: '#0284c7',
    edgeHi: '#2563eb',
    risk: '#dc2626',
    text: '#1b2433',
    textMuted: '#5d6b85',
    labelBg: '#ffffff',
  },
} as const;

const FONT = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

export function getGraphStyle(mode: Mode): cytoscape.Stylesheet[] {
  const c = PALETTE[mode];
  const edgeRamp = `mapData(heat, 0, 1, ${c.edgeLow}, ${c.edgeHigh})`;
  const hopRamp = `mapData(tone, 0, 1, ${c.hopNear}, ${c.hopFar})`;

  const style = [
    {
      selector: 'node',
      style: {
        shape: 'ellipse',
        width: 'data(size)',
        height: 'data(size)',
        'background-color': hopRamp,
        'background-opacity': 1,
        'border-width': 2.5,
        'border-color': c.nodeBorder,
        'underlay-color': hopRamp,
        'underlay-padding': 7,
        'underlay-opacity': 0.14,
        'underlay-shape': 'ellipse',
        label: 'data(label)',
        color: c.text,
        'font-family': FONT,
        'font-size': 10,
        'text-wrap': 'wrap',
        'text-valign': 'bottom',
        'text-halign': 'center',
        'text-margin-y': 9,
        'text-background-color': c.labelBg,
        'text-background-opacity': 0.8,
        'text-background-padding': '3px',
        'text-background-shape': 'roundrectangle',
        'min-zoomed-font-size': 7,
        'overlay-opacity': 0,
        'transition-property': 'opacity, border-width, border-color, underlay-opacity',
        'transition-duration': 140,
      },
    },
    {
      selector: 'node[labelType = "EXCHANGE"]',
      style: { 'background-color': c.exchange, 'underlay-color': c.exchange, 'underlay-opacity': 0.22 },
    },
    {
      selector: 'node[labelType = "MIXER"]',
      style: { 'background-color': c.mixer, 'underlay-color': c.mixer, 'underlay-opacity': 0.22 },
    },
    {
      selector: 'node[labelType = "SANCTIONED"]',
      style: {
        'background-color': c.sanctioned,
        'border-color': c.sanctioned,
        'border-width': 3,
        'underlay-color': c.sanctioned,
        'underlay-opacity': 0.3,
        'underlay-padding': 10,
      },
    },
    {
      selector: 'node.is-leaf',
      style: {
        'border-style': 'dashed',
        'border-color': c.textMuted,
        'border-width': 1.5,
        'underlay-opacity': 0.08,
      },
    },
    {
      selector: 'node.is-root',
      style: {
        'background-color': c.root,
        'border-width': 4,
        'border-color': c.root,
        'border-opacity': 0.4,
        'underlay-color': c.root,
        'underlay-opacity': 0.28,
        'underlay-padding': 14,
        'font-size': 11,
        'font-weight': 'bold',
        'z-index': 10,
      },
    },

    {
      selector: 'edge',
      style: {
        'curve-style': 'bezier',
        'control-point-step-size': 40,
        width: 'data(w)',
        'line-color': edgeRamp,
        'target-arrow-color': edgeRamp,
        'target-arrow-shape': 'triangle',
        'arrow-scale': 1.05,
        opacity: 0.9,
        'font-family': FONT,
        'font-size': 9,
        color: c.text,
        'text-rotation': 'autorotate',
        'text-margin-y': -9,
        'text-background-color': c.labelBg,
        'text-background-opacity': 0.85,
        'text-background-padding': '2px',
        'text-background-shape': 'roundrectangle',
        'min-zoomed-font-size': 8,
        'overlay-opacity': 0,
        'transition-property': 'opacity, line-color, width',
        'transition-duration': 140,
      },
    },
    { selector: 'edge.show-amount', style: { label: 'data(amountLabel)' } },
    {
      selector: 'edge[?onRiskPath]',
      style: { 'line-color': c.risk, 'target-arrow-color': c.risk, opacity: 0.95 },
    },
    { selector: 'edge.is-hover-label', style: { label: 'data(amountLabel)', 'z-index': 20 } },

    /* Hover: path stays lit, everything else fades. */
    { selector: '.is-faded', style: { opacity: 0.1, 'text-opacity': 0 } },
    {
      selector: 'edge.is-hover',
      style: { 'line-color': c.edgeHi, 'target-arrow-color': c.edgeHi, opacity: 1 },
    },
    { selector: 'node.is-hover', style: { opacity: 1, 'underlay-opacity': 0.3 } },

    /* Filter emphasis from the toolbar. */
    { selector: '.is-dimmed', style: { opacity: 0.16 } },
    {
      selector: 'edge.is-on-path',
      style: { 'line-color': c.edgeHi, 'target-arrow-color': c.edgeHi, opacity: 1 },
    },

    /* Selection. */
    {
      selector: 'node.is-selected',
      style: {
        'border-width': 4,
        'border-color': c.edgeHi,
        'border-opacity': 1,
        'underlay-color': c.edgeHi,
        'underlay-opacity': 0.35,
>>>>>>> origin/main
      },
    },
    {
      selector: 'edge.is-selected',
<<<<<<< HEAD
      style: {
        'width': 3,
        'line-color': colors.selection,
        'target-arrow-color': colors.selection,
      },
    },
    {
      selector: '.is-dimmed',
      style: {
        opacity: 0.2,
      },
    }
  ];
};
=======
      style: { 'line-color': c.edgeHi, 'target-arrow-color': c.edgeHi, opacity: 1, 'z-index': 30 },
    },
  ];

  return style as unknown as cytoscape.Stylesheet[];
}
>>>>>>> origin/main
