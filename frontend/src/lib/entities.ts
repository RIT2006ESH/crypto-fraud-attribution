import type { LabelType } from '../types';

/**
 * Forensic entity semantics.
 *
 * These mappings are the single place where a label type becomes a colour, a word
 * and a shape. Colour is never applied alone: every consumer also renders the
 * `label` text and/or the `glyph`, so the interface stays readable without colour.
 */

export type EntityKind = 'target' | LabelType | 'wallet';

export interface EntityMeta {
  label: string;
  /** Short form for dense UI (graph labels, legend). */
  short: string;
  /** CSS custom property reference for the stroke / fill / text colour. */
  color: string;
  /** Text + shape double-encoding so risk is never colour-only. */
  glyph: string;
  description: string;
}

export const ENTITY_META: Record<EntityKind, EntityMeta> = {
  target: {
    label: 'Reported Wallet',
    short: 'Target',
    color: 'var(--entity-target)',
    glyph: '◆',
    description: 'The wallet address submitted for investigation.',
  },
  EXCHANGE: {
    label: 'Exchange / VASP',
    short: 'Exchange',
    color: 'var(--entity-exchange)',
    glyph: '◈',
    description: 'An address resolved to a regulated or centralised service.',
  },
  MIXER: {
    label: 'Mixer',
    short: 'Mixer',
    color: 'var(--entity-mixer)',
    glyph: '◐',
    description: 'An address resolved to a mixing or obfuscation service.',
  },
  SANCTIONED: {
    label: 'Sanctioned',
    short: 'Sanctioned',
    color: 'var(--entity-sanctioned)',
    glyph: '▲',
    description: 'An address present on a published sanctions list.',
  },
  UNLABELED: {
    label: 'Unlabelled',
    short: 'Unlabelled',
    color: 'var(--entity-unlabelled)',
    glyph: '○',
    description: 'No attribution was resolved for this address.',
  },
  wallet: {
    label: 'Wallet',
    short: 'Wallet',
    color: 'var(--entity-wallet)',
    glyph: '◇',
    description: 'A mapped address in the traced subgraph.',
  },
};

const LABEL_FALLBACK = ENTITY_META.UNLABELED;

/**
 * Maps an entity kind (or a backend labelType, or null) to its presentation.
 *
 * Accepts the wider `EntityKind` so marketing diagrams can mark the reported wallet
 * as a target, while live data coming straight from the API only ever supplies a
 * `LabelType`.
 */
export function entityMeta(kind: EntityKind | LabelType | null | undefined): EntityMeta {
  if (!kind) return LABEL_FALLBACK;
  return ENTITY_META[kind] ?? LABEL_FALLBACK;
}

export function entityColor(kind: EntityKind | LabelType | null | undefined): string {
  return entityMeta(kind).color;
}

/** CSS class suffix used by both the graph stylesheet and the ledger. */
export function entityClass(kind: EntityKind | LabelType | null | undefined): string {
  switch (kind) {
    case 'target':
      return 'target';
    case 'EXCHANGE':
      return 'exchange';
    case 'MIXER':
      return 'mixer';
    case 'SANCTIONED':
      return 'sanctioned';
    case 'UNLABELED':
      return 'unlabelled';
    default:
      return 'wallet';
  }
}

/** The four label types a label set can resolve to, in legend order. */
export const LABEL_ORDER: LabelType[] = ['EXCHANGE', 'MIXER', 'SANCTIONED', 'UNLABELED'];
