import type { GraphFilter, GraphMode } from './model';

/**
 * Filter and mode definitions.
 *
 * Kept beside the data rather than in the panel, so the descriptions — which are what
 * an investigator reads in a tooltip before committing to a mode — are written once
 * and stay consistent with the behaviour the mode actually applies.
 */

export const GRAPH_FILTERS: {
  id: GraphFilter;
  label: string;
  glyph: string;
  description: string;
}[] = [
  { id: 'all', label: 'All', glyph: '◎', description: 'Every address in the traced subgraph.' },
  { id: 'known', label: 'Known', glyph: '◈', description: 'Addresses resolved to a known entity.' },
  { id: 'high-risk', label: 'High risk', glyph: '▲', description: 'Addresses labelled as mixers or tumblers.' },
  { id: 'mixers', label: 'Mixers', glyph: '◐', description: 'Addresses labelled as mixers or tumblers.' },
  { id: 'sanctioned', label: 'Sanctioned', glyph: '⬥', description: 'Addresses on a published sanctions list.' },
  { id: 'unlabelled', label: 'Unlabelled', glyph: '○', description: 'Addresses with no resolved attribution.' },
];

export const GRAPH_MODES: { id: GraphMode; label: string; description: string }[] = [
  { id: 'DEFAULT', label: 'Default', description: 'The full subgraph at uniform emphasis.' },
  {
    id: 'RISK_FOCUS',
    label: 'Risk focus',
    description: 'Mixer, sanctioned and service-flagged elements, with the selection in full contrast.',
  },
  {
    id: 'ENTITY_FOCUS',
    label: 'Entity focus',
    description: 'Resolved entities stay prominent; surrounding wallets recede but remain.',
  },
  {
    id: 'PATH_FOCUS',
    label: 'Path focus',
    description: 'The chain of transfers connecting the reported wallet to the selection.',
  },
];
