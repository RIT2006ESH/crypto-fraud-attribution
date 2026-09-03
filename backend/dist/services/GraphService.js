import { graphRepository } from "../db/repositories/index.js";
export class GraphService {
    getGraphForTrace(traceId, walletAddress, chain) {
        const cached = graphRepository.findCacheByTraceId(traceId);
        if (cached) {
            try {
                return JSON.parse(cached.graphJson);
            }
            catch {
                // Fallback to rebuilding if JSON is corrupt
            }
        }
        const nodes = graphRepository.findNodesByTraceId(traceId);
        const edges = graphRepository.findEdgesByTraceId(traceId);
        const graph = this.assembleCytoscapeGraph(nodes, edges, walletAddress, chain);
        graphRepository.saveCache(traceId, JSON.stringify(graph));
        return graph;
    }
    assembleCytoscapeGraph(nodes, edges, walletAddress, chain) {
        const rootLower = walletAddress.toLowerCase();
        const nodeDtos = nodes.map((n) => {
            const type = n.labelType || (n.address.toLowerCase() === rootLower ? "WALLET" : "UNLABELED");
            return {
                id: n.address.toLowerCase(),
                address: n.address,
                type,
                hopDepth: n.hopDepth,
                confidence: n.labelConfidence ?? null,
                labelType: n.labelType || null,
                labelConfidence: n.labelConfidence ?? null,
            };
        });
        const edgeDtos = edges.map((e) => ({
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
            nodes: nodeDtos,
            edges: edgeDtos,
        };
    }
}
export const graphService = new GraphService();
