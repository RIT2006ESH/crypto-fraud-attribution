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
      },
    },
    {
      selector: 'edge.is-selected',
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
