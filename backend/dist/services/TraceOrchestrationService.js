import { config } from "../config.js";
import { addressLabelRepository, graphEdgeRepository, graphNodeRepository, traceRequestRepository, auditRepository, } from "../db/database.js";
import { TraceService } from "./TraceService.js";
import { RiskScoringService } from "./RiskScoringService.js";
import { detectChain } from "../util/address.js";
import { LabelType, TraceStatus, } from "../types/index.js";
/** Real chains the system can trace on (excludes the "all" meta-entry). */
const REAL_CHAINS = ["ethereum", "tron"];
export class TraceOrchestrationService {
    traceService;
    riskScoringService;
    preferCached;
    constructor(labelService) {
        this.traceService = new TraceService(labelService);
        this.riskScoringService = new RiskScoringService();
        this.preferCached = config.trace.preferCached;
    }
    /**
     * Main entry point.  When `chain === "all"` runs a parallel scan across all chains
     * compatible with the address format; otherwise runs a single-chain trace.
     */
    async submit(input) {
        const chain = (input.chain || "").trim().toLowerCase() || "all";
        if (chain === "all") {
            return this.submitMultiChain(input);
        }
        return this.submitSingleChain({ ...input, chain });
    }
    // ── Single-chain trace ────────────────────────────────────────────────────
    async submitSingleChain(input) {
        const chain = (input.chain || "ethereum").toLowerCase();
        const address = input.walletAddress.trim();
        if (this.preferCached) {
            const cached = this.replay(address, chain, null);
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
        if (request.status === TraceStatus.COMPLETED) {
            const risk = this.riskScoringService.score(request, nodes, edges);
            request = traceRequestRepository.save({
                ...request,
                riskScore: risk.score,
                flaggedPatterns: risk.patterns.join(" | "),
            });
            auditRepository.save({
                caseId: request.caseId,
                investigationId: request.id,
                eventType: "INVESTIGATION_COMPLETED",
                actorType: "SYSTEM",
                metadataJson: JSON.stringify({ riskScore: risk.score })
            });
        }
        else {
            auditRepository.save({
                caseId: request.caseId,
                investigationId: request.id,
                eventType: "INVESTIGATION_FAILED",
                actorType: "SYSTEM"
            });
        }
        const thin = request.status !== TraceStatus.COMPLETED || nodes.length <= 1;
        if (thin) {
            const cached = this.replay(address, chain, request.id);
            if (cached) {
                console.warn(`[OrchestrationService] Live trace of ${address}/${chain} returned nothing; replaying last good trace`);
                return cached;
            }
        }
        return this.assemble(request, nodes, edges, false);
    }
    // ── Multi-chain parallel scan ─────────────────────────────────────────────
    /**
     * Determines which chains are applicable for the given address format, then runs
     * a trace on each in parallel.  Results are merged into a MultiChainTraceResultDto.
     *
     * Address format rules:
     *   0x…  (EVM)  → Ethereum only (for MVP; finals adds BSC, Polygon, etc.)
     *   T…   (Tron) → Tron only
     *   unknown     → all chains attempted, failures suppressed per-chain
     */
    async submitMultiChain(input) {
        const address = input.walletAddress.trim();
        const detectedChain = detectChain(address);
        // Determine which chains to actually attempt.
        let chainsToScan;
        if (detectedChain) {
            // Address format clearly belongs to one chain — scan that chain only.
            // We still return the MultiChainTraceResultDto envelope so the frontend always
            // gets the same shape regardless of whether chain="all" or chain="ethereum" was sent.
            chainsToScan = [detectedChain];
        }
        else {
            // Unknown format — try all real chains; each will fail gracefully if unsupported.
            chainsToScan = [...REAL_CHAINS];
        }
        console.log(`[OrchestrationService] multi-chain scan of ${address} on: ${chainsToScan.join(", ")}`);
        // Fan out — all chains run in parallel.
        const settled = await Promise.allSettled(chainsToScan.map((chain) => this.submitSingleChain({ ...input, chain })));
        // Assemble per-chain results.
        const traceIds = {};
        const perChain = {};
        chainsToScan.forEach((chain, i) => {
            const result = settled[i];
            if (result.status === "fulfilled") {
                perChain[chain] = result.value;
                traceIds[chain] = result.value.id;
            }
            else {
                const msg = result.reason instanceof Error ? result.reason.message : String(result.reason);
                console.error(`[OrchestrationService] ${chain} trace failed: ${msg}`);
                perChain[chain] = { error: msg };
            }
        });
        // Find the shallowest exchange across all chains.
        let nearestExchange = null;
        let overallRiskScore = 0;
        for (const result of Object.values(perChain)) {
            if ("error" in result)
                continue;
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
    get(id) {
        const request = traceRequestRepository.findById(id);
        if (!request)
            return null;
        const nodes = graphNodeRepository.findByTraceId(request.id);
        const edges = graphEdgeRepository.findByTraceId(request.id);
        return this.assemble(request, nodes, edges, false);
    }
    /** List recent traces (for the history panel). */
    list(limit = 50, offset = 0) {
        const requests = traceRequestRepository.findAll(limit, offset);
        return requests.map((req) => {
            const nodes = graphNodeRepository.findByTraceId(req.id);
            const edges = graphEdgeRepository.findByTraceId(req.id);
            return this.assemble(req, nodes, edges, false);
        });
    }
    // ── Internals ─────────────────────────────────────────────────────────────
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
        const limitations = [];
        if (nodes.length >= config.trace.maxNodes) {
            limitations.push("Trace stopped at configured node limit");
        }
        let attributionConfidence = 0;
        let attributionLevel = "UNKNOWN";
        const attributionReasons = [];
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
                sources: [{ provider: request.chain === "ethereum" ? "ETHERSCAN" : "TRONGRID" }],
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
