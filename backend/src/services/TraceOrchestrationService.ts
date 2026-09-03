import { config } from "../config/index.js";
import { labelRepository, graphRepository, traceRepository } from "../db/repositories/index.js";
import { TraceService } from "./TraceService.js";
import { RiskScoringService } from "./RiskScoringService.js";
import { graphService } from "./GraphService.js";
import {
  EdgeDto,
  ExchangeDto,
  GraphEdge,
  GraphNode,
  LabelType,
  NodeDto,
  TraceRequest,
  TraceRequestDto,
  TraceResultDto,
  TraceStatus,
} from "../types/index.js";

export class TraceOrchestrationService {
  private traceService: TraceService;
  private riskScoringService: RiskScoringService;
  private preferCached: boolean;

  constructor() {
    this.traceService = new TraceService();
    this.riskScoringService = new RiskScoringService();
    this.preferCached = config.trace.preferCached;
  }

  async submit(input: TraceRequestDto): Promise<TraceResultDto> {
    const chain = (input.chain || "").trim() ? input.chain!.toLowerCase() : "ethereum";
    const address = input.walletAddress.trim();

    if (this.preferCached) {
      const cached = this.replay(address, chain, null);
      if (cached) {
        console.log(`[OrchestrationService] Serving ${address} from cache (trace.prefer-cached=true)`);
        return cached;
      }
    }

    let request = traceRepository.save({
      caseId: input.caseId || null,
      walletAddress: address,
      chain,
      status: TraceStatus.QUEUED,
    });

    request = await this.traceService.trace(request);

    let nodes = graphRepository.findNodesByTraceId(request.id);
    let edges = graphRepository.findEdgesByTraceId(request.id);

    if (request.status === TraceStatus.COMPLETED) {
      const risk = this.riskScoringService.score(request, nodes, edges);
      request = traceRepository.save({
        ...request,
        riskScore: risk.score,
        flaggedPatterns: risk.reasons.join(" | "),
      });
    }

    const thin = request.status !== TraceStatus.COMPLETED || nodes.length <= 1;
    if (thin) {
      const cached = this.replay(address, chain, request.id);
      if (cached) {
        console.warn(`[OrchestrationService] Live trace of ${address} returned nothing usable; replaying last good trace`);
        return cached;
      }
    }

    // Populate graph cache
    graphService.getGraphForTrace(request.id, address, chain);

    return this.assemble(request, nodes, edges, false);
  }

  get(id: string): TraceResultDto | null {
    const request = traceRepository.findById(id);
    if (!request) return null;

    const nodes = graphRepository.findNodesByTraceId(request.id);
    const edges = graphRepository.findEdgesByTraceId(request.id);

    return this.assemble(request, nodes, edges, false);
  }

  private replay(address: string, chain: string, excludeId?: string | null): TraceResultDto | null {
    const completedRequests = traceRepository.findByWalletAddressIgnoreCaseAndChainAndStatusIn(
      address,
      chain,
      [TraceStatus.COMPLETED]
    );

    const candidates = completedRequests.filter((r: TraceRequest) => !excludeId || r.id !== excludeId);
    if (candidates.length === 0) return null;

    candidates.sort((a: TraceRequest, b: TraceRequest) => {
      const timeA = a.completedAt ? new Date(a.completedAt).getTime() : 0;
      const timeB = b.completedAt ? new Date(b.completedAt).getTime() : 0;
      return timeB - timeA;
    });

    for (const req of candidates) {
      const nodes = graphRepository.findNodesByTraceId(req.id);
      const edges = graphRepository.findEdgesByTraceId(req.id);

      if (nodes.length > 0) {
        return this.assemble(req, nodes, edges, true);
      }
    }

    return null;
  }

  private assemble(request: TraceRequest, nodes: GraphNode[], edges: GraphEdge[], fromCache: boolean): TraceResultDto {
    const exchangeNodes = nodes.filter((n) => n.labelType === LabelType.EXCHANGE);
    let nearestExchange: ExchangeDto | null = null;

    if (exchangeNodes.length > 0) {
      const nearestNode = exchangeNodes.reduce((min, cur) => (cur.hopDepth < min.hopDepth ? cur : min));
      const label = labelRepository.findByAddressIgnoreCaseAndChain(nearestNode.address, request.chain);
      nearestExchange = {
        address: nearestNode.address,
        entity: label?.entityName || null,
        hopDepth: nearestNode.hopDepth,
      };
    }

    const rootLower = request.walletAddress.toLowerCase();
    const nodeDtos: NodeDto[] = [...nodes]
      .sort((a, b) => a.hopDepth - b.hopDepth)
      .map((n) => ({
        id: n.address.toLowerCase(),
        address: n.address,
        type: n.labelType || (n.address.toLowerCase() === rootLower ? "WALLET" : "UNLABELED"),
        hopDepth: n.hopDepth,
        confidence: n.labelConfidence ?? null,
        labelType: n.labelType || null,
        labelConfidence: n.labelConfidence ?? null,
      }));

    const edgeDtos: EdgeDto[] = edges.map((e) => ({
      id: `${e.fromAddress.toLowerCase()}-${e.toAddress.toLowerCase()}-${e.txHash}`,
      from: e.fromAddress.toLowerCase(),
      to: e.toAddress.toLowerCase(),
      fromAddress: e.fromAddress,
      toAddress: e.toAddress,
      txHash: e.txHash,
      amount: e.amount,
      timestamp: e.txTimestamp || "",
      txTimestamp: e.txTimestamp || null,
    }));

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
    };
  }
}

export const traceOrchestrationService = new TraceOrchestrationService();
