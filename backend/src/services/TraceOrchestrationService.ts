import { config } from "../config.js";
import {
  addressLabelRepository,
  graphEdgeRepository,
  graphNodeRepository,
  traceRequestRepository,
  auditRepository,
} from "../db/database.js";
import { TraceService } from "./TraceService.js";
import { RiskScoringService } from "./RiskScoringService.js";
import { MlService, MlAnalyzeResult } from "./MlService.js";
import { LabelService } from "../labels/LabelService.js";
import { detectChain } from "../util/address.js";
import {
  EdgeDto,
  ExchangeDto,
  GraphEdge,
  GraphNode,
  LabelType,
  MlInsightDto,
  MultiChainTraceResultDto,
  NodeDto,
  TraceRequest,
  TraceRequestDto,
  TraceResultDto,
  TraceStatus,
} from "../types/index.js";

/** Real chains the system can trace on (excludes the "all" meta-entry). */
const REAL_CHAINS = ["ethereum", "polygon", "tron"] as const;

export class TraceOrchestrationService {
  private traceService: TraceService;
  private riskScoringService: RiskScoringService;
  private mlService: MlService;
  private preferCached: boolean;
  /**
   * Live traces run one at a time. Two overlapping traces double the Etherscan
   * call rate and the free tier answers the burst with a bogus "Invalid API Key",
   * killing both. A queued scan waits instead of stacking.
   */
  private traceQueue: Promise<void> = Promise.resolve();

  constructor(labelService?: LabelService, mlService?: MlService) {
    this.traceService = new TraceService(labelService);
    this.riskScoringService = new RiskScoringService();
    this.mlService = mlService ?? new MlService();
    this.preferCached = config.trace.preferCached;
  }

  /**
   * Main entry point.  When `chain === "all"` runs a parallel scan across all chains
   * compatible with the address format; otherwise runs a single-chain trace.
   */
  async submit(input: TraceRequestDto): Promise<TraceResultDto | MultiChainTraceResultDto> {
    const chain = (input.chain || "").trim().toLowerCase() || "all";

    if (chain === "all") {
      return this.submitMultiChain(input);
    }

    return this.submitSingleChain({ ...input, chain });
  }

  // ── Single-chain trace ────────────────────────────────────────────────────

  async submitSingleChain(input: TraceRequestDto): Promise<TraceResultDto> {
    const run = this.traceQueue.then(() => this.runSingleChain(input));
    this.traceQueue = run.then(
      () => undefined,
      () => undefined
    );
    return run;
  }

  private async runSingleChain(input: TraceRequestDto): Promise<TraceResultDto> {
    const chain = (input.chain || "ethereum").toLowerCase();
    const address = input.walletAddress.trim();

    if (this.preferCached) {
      const cached = await this.replay(address, chain, null);
      if (cached) {
        console.log(`[OrchestrationService] Serving ${address}/${chain} from cache`);
        return cached;
      }
    }

    let request = traceRequestRepository.save({
      caseId: input.caseId || null,
      walletAddress: address,
      chain,
      status: TraceStatus.QUEUED,
    });

    auditRepository.save({
      caseId: request.caseId,
      investigationId: request.id,
      eventType: "INVESTIGATION_STARTED",
      actorType: "SYSTEM"
    });

    request = await this.traceService.trace(request);

    let nodes = graphNodeRepository.findByTraceId(request.id);
    let edges = graphEdgeRepository.findByTraceId(request.id);

    // ML enrichment over the traced subgraph (XGBoost/SHAP, Isolation Forest,
    // label propagation + clustering, layering rules). Best-effort: null when
    // ML_URL is unset or the service is unreachable — the trace still succeeds.
    let ml: MlAnalyzeResult | null = null;

    if (request.status === TraceStatus.COMPLETED) {
      const risk = this.riskScoringService.score(request, nodes, edges);
      ml = await this.mlService.analyze(nodes, edges, address);
      // Behavioural mixer upgrades: UNLABELED nodes shaped like mixer pools become
      // MIXER (source ml:behavioral) so legend counts, filters, ledger and the
      // mixer risk weight all follow — no registry hit required.
      const upgradedMixers = this.applyMixerUpgrades(request.id, chain, nodes, ml);
      // Identical signals from many nodes (e.g. 25x rapid pass-through) collapse
      // to one line; per-node detail stays in the ml.layering payload.
      const mlPatterns = [...new Set(
        (ml?.layering ?? []).map((p) => `ML layering signal: ${p.type} — ${p.detail}`)
      )];
      // Unsupervised outlier headcount reaches the risk signals even when no
      // structural rule names the node — the point of anomaly detection.
      const anomalousCount = ml ? Object.values(ml.nodes).filter((n) => n.anomaly >= 0.8).length : 0;
      if (anomalousCount > 0) {
        mlPatterns.push(
          `ML anomaly: ${anomalousCount} address(es) score far outside this trace's norm (unsupervised Isolation Forest, no labelled fraud data)`
        );
      }
      if (upgradedMixers.length > 0) {
        mlPatterns.push(
          `Funds routed through a suspected mixer (${upgradedMixers.length} address(es) flagged by behavioural model)`
        );
      }
      const patterns =
        mlPatterns.length > 0
          ? [...risk.patterns.filter((p) => p !== "No high-risk patterns detected"), ...mlPatterns]
          : risk.patterns;
      // Mirror the rule engine's mixer weight for ML-upgraded nodes.
      const score = Math.min(100, risk.score + (upgradedMixers.length > 0 ? 45 : 0));
      request = traceRequestRepository.save({
        ...request,
        riskScore: score,
        flaggedPatterns: patterns.join(" | "),
      });
      auditRepository.save({
        caseId: request.caseId,
        investigationId: request.id,
        eventType: "INVESTIGATION_COMPLETED",
        actorType: "SYSTEM",
        metadataJson: JSON.stringify({ riskScore: score })
      });
    } else {
      auditRepository.save({
        caseId: request.caseId,
        investigationId: request.id,
        eventType: "INVESTIGATION_FAILED",
        actorType: "SYSTEM"
      });
    }

    const thin = request.status !== TraceStatus.COMPLETED || nodes.length <= 1;
    if (thin) {
      const cached = await this.replay(address, chain, request.id);
      if (cached) {
        console.warn(`[OrchestrationService] Live trace of ${address}/${chain} returned nothing; replaying last good trace`);
        // A replayed result without this notice reads as "the same stale output".
        // State plainly that the live attempt failed and how old the fallback is.
        if (request.status === TraceStatus.FAILED) {
          cached.limitations = [
            ...(cached.limitations ?? []),
            `Live trace failed (${request.failureReason ?? "unknown error"}); showing last good result from ${cached.completedAt ?? "an earlier run"}.`,
          ];
        }
        return cached;
      }
    }

    return this.assemble(request, nodes, edges, false, ml);
  }

  // ── Multi-chain parallel scan ─────────────────────────────────────────────

  /**
   * Determines which chains are applicable for the given address format, then runs
   * a trace on each in parallel.  Results are merged into a MultiChainTraceResultDto.
   *
   * Address format rules:
   *   0x…  (EVM)  → Ethereum or Polygon
   *   T…   (Tron) → Tron only
   *   unknown     → all chains attempted, failures suppressed per-chain
   */
  async submitMultiChain(input: TraceRequestDto): Promise<MultiChainTraceResultDto> {
    const address = input.walletAddress.trim();
    const detectedChain = detectChain(address);

    // Determine which chains to actually attempt.
    let chainsToScan: string[];
    if (detectedChain) {
      // Address format clearly belongs to one chain — scan that chain only.
      // We still return the MultiChainTraceResultDto envelope so the frontend always
      // gets the same shape regardless of whether chain="all" or chain="ethereum" was sent.
      chainsToScan = [detectedChain];
    } else {
      // Unknown format — try all real chains; each will fail gracefully if unsupported.
      chainsToScan = [...REAL_CHAINS];
    }

    console.log(`[OrchestrationService] multi-chain scan of ${address} on: ${chainsToScan.join(", ")}`);

    // Fan out — all chains run in parallel.
    const settled = await Promise.allSettled(
      chainsToScan.map((chain) =>
        this.submitSingleChain({ ...input, chain })
      )
    );

    // Assemble per-chain results.
    const traceIds: Record<string, string> = {};
    const perChain: Record<string, TraceResultDto | { error: string }> = {};

    chainsToScan.forEach((chain, i) => {
      const result = settled[i];
      if (result.status === "fulfilled") {
        perChain[chain] = result.value;
        traceIds[chain] = result.value.id;
      } else {
        const msg = result.reason instanceof Error ? result.reason.message : String(result.reason);
        console.error(`[OrchestrationService] ${chain} trace failed: ${msg}`);
        perChain[chain] = { error: msg };
      }
    });

    // Find the shallowest exchange across all chains.
    let nearestExchange: ExchangeDto | null = null;
    let overallRiskScore = 0;

    for (const result of Object.values(perChain)) {
      if ("error" in result) continue;
      if (result.riskScore != null && result.riskScore > overallRiskScore) {
        overallRiskScore = result.riskScore;
      }
      if (result.nearestExchange) {
        if (!nearestExchange || result.nearestExchange.hopDepth < nearestExchange.hopDepth) {
          nearestExchange = result.nearestExchange;
        }
      }
    }

    return {
      traceIds,
      perChain,
      nearestExchange,
      overallRiskScore,
      overallRiskCategory: RiskScoringService.categorize(overallRiskScore) ?? "LOW",
    };
  }

  // ── Fetch a saved trace ───────────────────────────────────────────────────

  get(id: string): TraceResultDto | null {
    const request = traceRequestRepository.findById(id);
    if (!request) return null;

    const nodes = graphNodeRepository.findByTraceId(request.id);
    const edges = graphEdgeRepository.findByTraceId(request.id);

    return this.assemble(request, nodes, edges, false);
  }

  /** List recent traces (for the history panel). */
  list(limit = 50, offset = 0): TraceResultDto[] {
    const requests = traceRequestRepository.findAll(limit, offset);
    return requests.map((req) => {
      const nodes = graphNodeRepository.findByTraceId(req.id);
      const edges = graphEdgeRepository.findByTraceId(req.id);
      return this.assemble(req, nodes, edges, false);
    });
  }

  // ── Internals ─────────────────────────────────────────────────────────────

  /**
   * Relabels UNLABELED graph nodes the ML model flags as behavioural mixers.
   * Curated labels are never touched; every upgrade is persisted to the graph
   * and the label cache with source "ml:behavioral" plus the model confidence.
   * Returns the upgraded addresses (lower-cased) for risk/pattern wiring.
   */
  private applyMixerUpgrades(
    traceId: string,
    chain: string,
    nodes: GraphNode[],
    ml: MlAnalyzeResult | null
  ): string[] {
    const upgraded: string[] = [];
    if (!ml) return upgraded;
    const byAddress = new Map(nodes.map((n) => [n.address.toLowerCase(), n]));
    for (const s of ml.suspected_mixers ?? []) {
      if (s.mixer_prob < 0.7) continue;
      const node = byAddress.get(s.address.toLowerCase());
      if (!node || (node.labelType ?? LabelType.UNLABELED) !== LabelType.UNLABELED) continue;
      graphNodeRepository.updateLabel(traceId, node.address, LabelType.MIXER, s.mixer_prob);
      try {
        addressLabelRepository.save({
          address: node.address,
          chain,
          labelType: LabelType.MIXER,
          entityName: "Suspected mixer (ML behavioural)",
          source: "ml:behavioral",
          confidence: s.mixer_prob,
        });
      } catch (error: unknown) {
        console.warn(`[OrchestrationService] could not cache ML mixer label: ${error instanceof Error ? error.message : error}`);
      }
      node.labelType = LabelType.MIXER;
      node.labelConfidence = s.mixer_prob;
      upgraded.push(node.address.toLowerCase());
    }
    if (upgraded.length > 0) {
      console.log(`[OrchestrationService] ML upgraded ${upgraded.length} node(s) to MIXER on ${traceId}`);
    }
    return upgraded;
  }

  private async replay(address: string, chain: string, excludeId?: string | null): Promise<TraceResultDto | null> {
    const completedRequests = traceRequestRepository.findByWalletAddressIgnoreCaseAndChainAndStatusIn(
      address,
      chain,
      [TraceStatus.COMPLETED]
    );

    const candidates = completedRequests.filter((r) => !excludeId || r.id !== excludeId);
    if (candidates.length === 0) return null;

    candidates.sort((a, b) => {
      const timeA = a.completedAt ? new Date(a.completedAt).getTime() : 0;
      const timeB = b.completedAt ? new Date(b.completedAt).getTime() : 0;
      return timeB - timeA;
    });

    for (const req of candidates) {
      const nodes = graphNodeRepository.findByTraceId(req.id);
      const edges = graphEdgeRepository.findByTraceId(req.id);

      if (nodes.length > 0) {
        // ML scoring is local and fast (~0.3s), so even a replayed result gets
        // fresh model output — a cached case never reads as "ML offline" again.
        const ml = await this.mlService.analyze(nodes, edges, address);
        this.applyMixerUpgrades(req.id, chain, nodes, ml);
        return this.assemble(req, nodes, edges, true, ml);
      }
    }

    return null;
  }

  private assemble(
    request: TraceRequest,
    nodes: GraphNode[],
    edges: GraphEdge[],
    fromCache: boolean,
    ml?: MlAnalyzeResult | null
  ): TraceResultDto {
    const exchangeNodes = nodes.filter((n) => n.labelType === LabelType.EXCHANGE);
    let nearestExchange: ExchangeDto | null = null;

    if (exchangeNodes.length > 0) {
      const nearestNode = exchangeNodes.reduce((min, cur) => (cur.hopDepth < min.hopDepth ? cur : min));
      const label = addressLabelRepository.findByAddressIgnoreCaseAndChain(nearestNode.address, request.chain);
      nearestExchange = {
        address: nearestNode.address,
        entity: label?.entityName || null,
        hopDepth: nearestNode.hopDepth,
      };
    } else if (ml?.vasp) {
      // No labelled exchange on the path, but the ML model inferred one
      // (feature similarity to a labelled exchange + sweep clustering).
      nearestExchange = {
        address: ml.vasp.address,
        entity: null,
        hopDepth: ml.vasp.hops,
      };
    }

    // Compact ML summary for API consumers (full per-node SHAP/anomaly map
    // stays in the ML service; only propagated exchange-like nodes surface here).
    let mlDto: MlInsightDto | null = null;
    if (ml) {
      const propagated = Object.entries(ml.nodes)
        .filter(([, v]) => v.propagated)
        .map(([addr, v]) => ({
          address: addr,
          similarity: v.propagated!.similarity,
          like: v.propagated!.like,
          basis: v.propagated!.basis ?? "tabular",
          exchangeProb: v.exchange_prob,
          reasons: v.reasons,
        }));
      const anomalies = Object.entries(ml.nodes)
        .map(([addr, v]) => ({
          address: addr,
          anomaly: v.anomaly,
          exchangeProb: v.exchange_prob,
          flags: v.flags,
        }))
        .filter((a) => a.anomaly >= 0.5)
        .sort((a, b) => b.anomaly - a.anomaly)
        .slice(0, 5);
      mlDto = {
        vasp: ml.vasp,
        alternatives: ml.alternatives ?? [],
        layering: ml.layering ?? [],
        propagated,
        clusters: ml.clusters ?? {},
        anomalies,
        anomalyAvailable: ml.anomaly_available ?? false,
        suspectedMixers: (ml.suspected_mixers ?? []).map((s) => ({
          address: s.address,
          mixerProb: s.mixer_prob,
          reasons: s.reasons,
        })),
        note: ml.note ?? null,
      };
    }

    const nodeDtos: NodeDto[] = [...nodes]
      .sort((a, b) => a.hopDepth - b.hopDepth)
      .map((n) => ({
        address: n.address,
        hopDepth: n.hopDepth,
        labelType: n.labelType || null,
        labelConfidence: n.labelConfidence ?? null,
      }));

    const edgeDtos: EdgeDto[] = edges.map((e) => ({
      fromAddress: e.fromAddress,
      toAddress: e.toAddress,
      txHash: e.txHash,
      amount: e.amount,
      txTimestamp: e.txTimestamp || null,
      tokenSymbol: e.tokenSymbol || null,
      tokenAddress: e.tokenAddress || null,
      transferType: e.transferType || "native",
    }));

    const entities = exchangeNodes.map(n => ({
      address: n.address,
      hopDepth: n.hopDepth,
      labelType: n.labelType,
      confidence: n.labelConfidence
    }));

    const limitations: string[] = [];
    if (nodes.length >= config.trace.maxNodes) {
      limitations.push("Trace stopped at configured node limit");
    }

    let attributionConfidence = 0;
    let attributionLevel = "UNKNOWN";
    const attributionReasons: string[] = [];
    if (nearestExchange) {
      attributionConfidence = 95;
      attributionLevel = "HIGH";
      attributionReasons.push("Identified direct link to known exchange entity");
    }

    const maxDepth = nodes.reduce((max, n) => Math.max(max, n.hopDepth || 0), 0);

    return {
      id: request.id,
      caseId: request.caseId || null,
      walletAddress: request.walletAddress,
      chain: request.chain,
      status: request.status,
      hopsTraced: request.hopsTraced ?? null,
      riskScore: request.riskScore ?? null,
      riskCategory: RiskScoringService.categorize(request.riskScore),
      flaggedPatterns: request.flaggedPatterns || null,
      requestedAt: request.requestedAt,
      completedAt: request.completedAt || null,
      failureReason: request.failureReason || null,
      servedFromCache: fromCache,
      nearestExchange,
      nodes: nodeDtos,
      edges: edgeDtos,
      ml: mlDto,
      findings: {
        summary: `Trace identified ${nodes.length} nodes and ${edges.length} transfers.`,
        targetAddress: request.walletAddress,
        chain: request.chain,
        traceDepth: maxDepth,
        nodes: nodes.length,
        transfers: edges.length,
        entities,
        keyPaths: nearestExchange ? [{
          pathId: `path-${nearestExchange.address}`,
          addresses: [request.walletAddress, nearestExchange.address],
          hops: nearestExchange.hopDepth,
          significance: "Path to nearest cashout point"
        }] : []
      },
      provenance: {
        sources: [{ provider: request.chain === "tron" ? "TRONGRID" : "ETHERSCAN" }],
        fetchedAt: request.requestedAt,
        riskEngineVersion: "1.0.0"
      },
      limitations,
      attribution: nearestExchange ? {
        primary: nearestExchange,
        confidence: {
          score: attributionConfidence,
          level: attributionLevel,
          reasons: attributionReasons
        }
      } : undefined
    };
  }
}
