/**
 * Risk model.
 *
 * These weights and thresholds mirror `backend/src/services/RiskScoringService.ts`
 * exactly, so the product explains the same arithmetic the server performs. If the
 * backend weights change, this file must change with them.
 */

export type RiskCategory = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface RiskRule {
  id: string;
  name: string;
  weight: number;
  /** The observable signal in the trace that triggers this rule. */
  signal: string;
}

export const RISK_RULES: RiskRule[] = [
  {
    id: 'root-sanctioned',
    name: 'Reported wallet is sanctioned',
    weight: 40,
    signal: 'The submitted address itself resolves to a published sanctions listing.',
  },
  {
    id: 'sanctioned-downstream',
    name: 'Sanctioned exposure',
    weight: 45,
    signal: 'A downstream address in the traced subgraph resolves to a sanctions listing.',
  },
  {
    id: 'mixer',
    name: 'Mixer interaction',
    weight: 45,
    signal: 'Funds reach an address labelled as a mixer or tumbler.',
  },
  {
    id: 'exchange-cashout',
    name: 'Exchange cash-out point',
    weight: 15,
    signal: 'A labelled exchange or VASP deposit address is reached within the trace depth.',
  },
  {
    id: 'layering',
    name: 'Layering across hops',
    weight: 20,
    signal: 'The path spans 3 or more hops before any cash-out point is reached.',
  },
  {
    id: 'high-fanout',
    name: 'High fan-out / structuring',
    weight: 15,
    signal: 'Funds split across 5 or more distinct destination addresses.',
  },
  {
    id: 'convergence',
    name: 'Fund convergence',
    weight: 10,
    signal: 'Three or more distinct source addresses fund a single wallet.',
  },
];

export const RISK_MAX_SCORE = 100;

/** Thresholds as implemented in `RiskScoringService.categorize`. */
export const RISK_THRESHOLDS: { category: RiskCategory; min: number; color: string; meaning: string }[] = [
  { category: 'CRITICAL', min: 75, color: 'var(--risk-critical)', meaning: 'Multiple high-weight indicators present.' },
  { category: 'HIGH', min: 50, color: 'var(--risk-high)', meaning: 'Elevated indicators warrant review.' },
  { category: 'MEDIUM', min: 25, color: 'var(--risk-medium)', meaning: 'Some indicators present; context required.' },
  { category: 'LOW', min: 0, color: 'var(--risk-low)', meaning: 'No high-weight indicator fired.' },
];

export function riskColor(category: RiskCategory | string | null | undefined): string {
  switch (category) {
    case 'CRITICAL':
      return 'var(--risk-critical)';
    case 'HIGH':
      return 'var(--risk-high)';
    case 'MEDIUM':
      return 'var(--risk-medium)';
    default:
      return 'var(--risk-low)';
  }
}

export function riskBadgeClass(category: RiskCategory | string | null | undefined): string {
  switch (category) {
    case 'CRITICAL':
      return 'badge badge--critical';
    case 'HIGH':
      return 'badge badge--high';
    case 'MEDIUM':
      return 'badge badge--medium';
    default:
      return 'badge badge--low';
  }
}

/** Applies the score cap exactly as the backend does. */
export function capScore(raw: number): number {
  return Math.min(Math.max(raw, 0), RISK_MAX_SCORE);
}

export function categorize(score: number | null | undefined): RiskCategory | null {
  if (score === null || score === undefined) return null;
  if (score >= 75) return 'CRITICAL';
  if (score >= 50) return 'HIGH';
  if (score >= 25) return 'MEDIUM';
  return 'LOW';
}
