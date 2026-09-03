import { RiskScoringService } from "../services/RiskScoringService.js";
export const resolvers = {
    Query: {
        trace: async (_, { id }, context) => {
            const traceResult = context.orchestrationService.get(id);
            if (!traceResult)
                return null;
            const graph = context.graphService.getGraphForTrace(traceResult.id, traceResult.walletAddress, traceResult.chain);
            const patterns = traceResult.flaggedPatterns
                ? traceResult.flaggedPatterns.split("|").map((p) => p.trim()).filter(Boolean)
                : ["No high-risk patterns detected"];
            const verdict = {
                score: traceResult.riskScore ?? 0,
                level: traceResult.riskCategory || RiskScoringService.categorize(traceResult.riskScore) || "LOW",
                reasons: patterns,
                nearestExchange: traceResult.nearestExchange
                    ? `${traceResult.nearestExchange.entity || "Exchange"} (${traceResult.nearestExchange.address})`
                    : null,
            };
            return {
                id: traceResult.id,
                walletAddress: traceResult.walletAddress,
                chain: traceResult.chain,
                status: traceResult.status || "COMPLETED",
                riskScore: traceResult.riskScore ?? 0,
                verdict,
                nodes: graph.nodes,
                edges: graph.edges,
            };
        },
        wallet: async (_, { address }, context) => {
            const label = context.labelRepository.findByAddressIgnoreCaseAndChain(address, "ethereum");
            if (!label) {
                return {
                    address,
                    labelType: "UNLABELED",
                    confidence: null,
                    entityName: null,
                };
            }
            return {
                address: label.address,
                labelType: label.labelType,
                confidence: label.confidence,
                entityName: label.entityName,
            };
        },
    },
};
