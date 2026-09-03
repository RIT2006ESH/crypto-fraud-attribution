import { graphRepository, labelRepository } from "../db/repositories/index.js";
import { EdgeDto, GraphEdge, GraphNode, NodeDto } from "../types/index.js";

export interface CytoscapeGraph {
  nodes: NodeDto[];
  edges: EdgeDto[];
}

export class GraphService {
  getGraphForTrace(traceId: string, walletAddress: string, chain: string): CytoscapeGraph {
    const cached = graphRepository.findCacheByTraceId(traceId);
    if (cached) {
      try {
        return JSON.parse(cached.graphJson) as CytoscapeGraph;
      } catch {
        // Fallback to rebuilding if JSON is corrupt
      }
    }

    const nodes = graphRepository.findNodesByTraceId(traceId);
    const edges = graphRepository.findEdgesByTraceId(traceId);

    const graph = this.assembleCytoscapeGraph(nodes, edges, walletAddress, chain);
    graphRepository.saveCache(traceId, JSON.stringify(graph));

    return graph;
  }

  assembleCytoscapeGraph(nodes: GraphNode[], edges: GraphEdge[], walletAddress: string, chain: string): CytoscapeGraph {
    const rootLower = walletAddress.toLowerCase();

    const nodeDtos: NodeDto[] = nodes.map((n) => {
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
      nodes: nodeDtos,
      edges: edgeDtos,
    };
  }
}

export const graphService = new GraphService();
