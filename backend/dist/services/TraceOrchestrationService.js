import { config } from "../config.js";
import { addressLabelRepository, graphEdgeRepository, graphNodeRepository, traceRequestRepository, } from "../db/database.js";
import { TraceService } from "./TraceService.js";
import { RiskScoringService } from "./RiskScoringService.js";
import { LabelType, TraceStatus, } from "../types/index.js";
export class TraceOrchestrationService {
    traceService;
    riskScoringService;
    preferCached;
    constructor() {
        this.traceService = new TraceService();
        this.riskScoringService = new RiskScoringService();
        this.preferCached = config.trace.preferCached;
    }
    async submit(input) {
        const chain = (input.chain || "").trim() ? input.chain.toLowerCase() : "ethereum";
        const address = input.walletAddress.trim();
        if (this.preferCached) {
            const cached = this.replay(address, chain, null);
            if (cached) {
                console.log(`[OrchestrationService] Serving ${address} from cache (trace.prefer-cached=true)`);
                return cached;
            }
        }
        let request = traceRequestRepository.save({
            caseId: input.caseId || null,
            walletAddress: address,
            chain,
            status: TraceStatus.QUEUED,
        });
        request = await this.traceService.trace(request);
        let nodes = graphNodeRepository.findByTraceId(request.id);
        let edges = graphEdgeRepository.findByTraceId(request.id);
        if (request.status === TraceStatus.COMPLETED) {
            const risk = this.riskScoringService.score(request, nodes, edges);
            request = traceRequestRepository.save({
                ...request,
                riskScore: risk.score,
                flaggedPatterns: risk.patterns.join(" | "),
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
        return this.assemble(request, nodes, edges, false);
    }
    get(id) {
        const request = traceRequestRepository.findById(id);
        if (!request)
            return null;
        const nodes = graphNodeRepository.findByTraceId(request.id);
        const edges = graphEdgeRepository.findByTraceId(request.id);
        return this.assemble(request, nodes, edges, false);
    }
    replay(address, chain, excludeId) {
        const completedRequests = traceRequestRepository.findByWalletAddressIgnoreCaseAndChainAndStatusIn(address, chain, [TraceStatus.COMPLETED]);
        const candidates = completedRequests.filter((r) => !excludeId || r.id !== excludeId);
        if (candidates.length === 0)
            return null;
        candidates.sort((a, b) => {
            const timeA = a.completedAt ? new Date(a.completedAt).getTime() : 0;
            const timeB = b.completedAt ? new Date(b.completedAt).getTime() : 0;
            return timeB - timeA;
        });
        for (const req of candidates) {
            const nodes = graphNodeRepository.findByTraceId(req.id);
            const edges = graphEdgeRepository.findByTraceId(req.id);
            if (nodes.length > 0) {
                return this.assemble(req, nodes, edges, true);
            }
        }
        return null;
    }
    assemble(request, nodes, edges, fromCache) {
        const exchangeNodes = nodes.filter((n) => n.labelType === LabelType.EXCHANGE);
        let nearestExchange = null;
        if (exchangeNodes.length > 0) {
            const nearestNode = exchangeNodes.reduce((min, cur) => (cur.hopDepth < min.hopDepth ? cur : min));
            const label = addressLabelRepository.findByAddressIgnoreCaseAndChain(nearestNode.address, request.chain);
            nearestExchange = {
                address: nearestNode.address,
                entity: label?.entityName || null,
                hopDepth: nearestNode.hopDepth,
            };
        }
        const nodeDtos = [...nodes]
            .sort((a, b) => a.hopDepth - b.hopDepth)
            .map((n) => ({
            address: n.address,
            hopDepth: n.hopDepth,
            labelType: n.labelType || null,
            labelConfidence: n.labelConfidence ?? null,
        }));
        const edgeDtos = edges.map((e) => ({
            fromAddress: e.fromAddress,
            toAddress: e.toAddress,
            txHash: e.txHash,
            amount: e.amount,
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
