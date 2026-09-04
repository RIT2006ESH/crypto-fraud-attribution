import type { ChainInfo, MultiChainTraceResult, TraceInput, TraceResult } from './types';

// ── Raw fetch wrapper ──────────────────────────────────────────────────────────

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(
      res.status === 400
        ? 'That address was rejected. Ensure it is a full Ethereum (0x…) or Tron (T…) wallet address.'
        : `The trace service returned ${res.status}. ${body.slice(0, 180)}`.trim()
    );
  }
  return res.json() as Promise<T>;
}

// ── Multi-chain normaliser ────────────────────────────────────────────────────

/**
 * When chain="all" the backend returns MultiChainTraceResult. We flatten it into a single
 * TraceResult so every component in the app stays simple and chain-agnostic.
 *
 * Strategy:
 *  1. Pick the first per-chain result that is not an error.
 *  2. Overlay the wrapper's overallRiskScore / overallRiskCategory / nearestExchange so the
 *     displayed scores always reflect the worst case across all chains.
 */
function normalizeTraceResponse(raw: TraceResult | MultiChainTraceResult): TraceResult {
  if (!('perChain' in raw)) return raw as TraceResult;

  const multi = raw as MultiChainTraceResult;
  const perChainValues = Object.values(multi.perChain);

  // Find first successful chain result (no "error" key).
  const first = perChainValues.find(
    (r): r is TraceResult => !('error' in r)
  );

  if (!first) {
    // All chains failed — surface the errors as a single failed result.
    const errors = perChainValues
      .map(r => ('error' in r ? r.error : ''))
      .filter(Boolean)
      .join(' | ');
    throw new Error(`All chains failed to trace: ${errors}`);
  }

  return {
    ...first,
    // Overlay aggregate fields from the multi-chain wrapper.
    riskScore: multi.overallRiskScore ?? first.riskScore,
    riskCategory: (multi.overallRiskCategory as TraceResult['riskCategory']) ?? first.riskCategory,
    nearestExchange: multi.nearestExchange ?? first.nearestExchange,
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

/** POST /api/traces — submits a trace on one or all chains. */
export async function submitTrace(input: TraceInput): Promise<TraceResult> {
  const raw = await fetchJson<TraceResult | MultiChainTraceResult>('/api/traces', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return normalizeTraceResponse(raw);
}

/** GET /api/traces/:id — fetches a previously run trace. */
export async function getTrace(id: string): Promise<TraceResult> {
  return fetchJson<TraceResult>(`/api/traces/${id}`);
}

/** GET /api/chains — returns the list of supported chains for the chain picker. */
export async function fetchChains(): Promise<ChainInfo[]> {
  return fetchJson<ChainInfo[]>('/api/chains');
}

