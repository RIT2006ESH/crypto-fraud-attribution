import { config } from "../config.js";
import type { GraphEdge, GraphNode } from "../types/index.js";

/**
 * Typed view of the Python ML service (`backend/ml-service/main.py`,
 * mirrored at repo-root `main.py`).
 *
 * The service covers four analytic layers over a traced subgraph:
 *   1. XGBoost exchange-likelihood + SHAP reasons per node
 *   2. Isolation Forest anomaly scores per node
 *   3. Label propagation (tabular feature similarity + structural role
 *      embeddings vs labelled exchanges) + heuristic cluster mining
 *      (deposit sweeps, many-to-one consolidation, common-funder siblings,
 *      common-input ownership)
 *   4. Layering rules (peel chains, fan-in/out, rapid pass-through, mixer/bridge)
 *
 * The service is optional: when `ML_URL` is unset or the service is
 * unreachable, `analyze()` returns null and callers fall back to the
 * rule-based `RiskScoringService`. ML never fails a trace.
 */

export interface MlNodeInsight {
  exchange_prob: number;
  mixer_prob: number;
  risk_score: number;
  anomaly: number;
  flags: string[];
  reasons: string[];
  propagated?: { similarity: number; like: string; basis?: string } | null;
  cluster_hot_wallet?: string | null;
}

export interface MlSuspectedMixer {
  address: string;
  mixer_prob: number;
  reasons: string[];
}

export interface MlLayeringPattern {
  type: string;
  nodes: string[];
  detail: string;
  /** Peak Isolation Forest anomaly over the pattern's nodes (0 when unscored). */
  max_anomaly?: number;
}

export interface MlVaspCandidate {
  address: string;
  basis: "known_label" | "inferred";
  confidence: number;
  hops: number;
  received: number;
  reasons: string[];
}

export interface MlAnalyzeResult {
  nodes: Record<string, MlNodeInsight>;
  layering: MlLayeringPattern[];
  clusters: Record<string, string[]>;
  vasp: MlVaspCandidate | null;
  alternatives: MlVaspCandidate[];
  /** False below 8 traced nodes — Isolation Forest has nothing to outlier from. */
  anomaly_available: boolean;
  /** Unlabelled nodes shaped like mixer pools (no registry hit needed). */
  suspected_mixers: MlSuspectedMixer[];
  note?: string;
}

interface MlNodeIn {
  id: string;
  labelType: string;
  hop: number;
  isRoot: boolean;
}

interface MlEdgeIn {
  source: string;
  target: string;
  amount: number;
  timestamp?: number | null;
  tx_hash?: string | null;
}

function toUnixSeconds(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime();
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : null;
}

export class MlService {
  private warnedUnavailable = false;

  get isEnabled(): boolean {
    return config.ml.url.length > 0;
  }

  /**
   * POSTs the traced subgraph to `{ML_URL}/analyze`.
   * Returns the parsed result, or null when disabled/unreachable/invalid.
   */
  async analyze(nodes: GraphNode[], edges: GraphEdge[], rootAddress: string): Promise<MlAnalyzeResult | null> {
    if (!this.isEnabled) return null;
    if (nodes.length === 0) return null;

    const root = rootAddress.toLowerCase();
    const payload = {
      nodes: nodes.map(
        (n): MlNodeIn => ({
          id: n.address,
          labelType: n.labelType || "UNLABELED",
          hop: n.hopDepth ?? 0,
          isRoot: n.address.toLowerCase() === root,
        })
      ),
      edges: edges
        .filter((e) => e.fromAddress && e.toAddress)
        .map(
          (e): MlEdgeIn => ({
            source: e.fromAddress,
            target: e.toAddress,
            amount: Number.parseFloat(e.amount) || 0,
            timestamp: toUnixSeconds(e.txTimestamp),
            tx_hash: e.txHash || null,
          })
        ),
    };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.ml.timeoutMs);
    try {
      const res = await fetch(`${config.ml.url}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      if (!res.ok) {
        this.warnOnce(`ML service returned ${res.status}; continuing without ML insights`);
        return null;
      }
      const data = (await res.json()) as MlAnalyzeResult;
      if (!data || typeof data !== "object" || !data.nodes) return null;
      return data;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      this.warnOnce(`ML service unreachable at ${config.ml.url} (${msg}); continuing without ML insights`);
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  private warnOnce(msg: string): void {
    if (!this.warnedUnavailable) {
      this.warnedUnavailable = true;
      console.warn(`[MlService] ${msg}`);
    }
  }
}
