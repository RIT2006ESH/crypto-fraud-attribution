import { config } from "../config/index.js";
import { labelRepository, graphRepository, traceRepository } from "../db/repositories/index.js";
import { EthereumChainClient } from "../chain/EthereumChainClient.js";
import { LabelType, TraceStatus } from "../types/index.js";
export class TraceService {
    clientsByChain;
    maxHops;
    maxFanOut;
    maxNodes;
    maxTxs;
    constructor() {
        this.clientsByChain = new Map();
        const ethClient = new EthereumChainClient();
        this.clientsByChain.set(ethClient.chain(), ethClient);
        this.maxHops = config.trace.maxHops;
        this.maxFanOut = config.trace.maxFanOut;
        this.maxNodes = config.trace.maxNodes;
        this.maxTxs = config.trace.maxTxs;
    }
    async trace(request) {
        const client = this.clientsByChain.get(request.chain.toLowerCase());
        if (!client) {
            return traceRepository.save({
                ...request,
                status: TraceStatus.FAILED,
                failureReason: `Unsupported chain: ${request.chain}`,
            });
        }
        let updatedReq = traceRepository.save({
            ...request,
            status: TraceStatus.TRACING,
        });
        const traceId = updatedReq.id;
        const chain = updatedReq.chain;
        const root = updatedReq.walletAddress;
        const visited = new Set();
        const queue = [];
        let maxDepthReached = 0;
        let nodeCount = 0;
        let txCount = 0;
        try {
            const rootLabel = this.persistNode(traceId, root, chain, 0);
            visited.add(root.toLowerCase());
            nodeCount++;
            if (!this.isTerminal(rootLabel)) {
                queue.push({ address: root, depth: 0 });
            }
            while (queue.length > 0 && nodeCount < this.maxNodes && txCount < this.maxTxs) {
                const hop = queue.shift();
                if (hop.depth >= this.maxHops)
                    continue;
                const nextDepth = hop.depth + 1;
                const outgoing = await client.getOutgoingTransactions(hop.address);
                outgoing.sort((a, b) => parseFloat(b.amount) - parseFloat(a.amount));
                let fanned = 0;
                for (const tx of outgoing) {
                    if (fanned >= this.maxFanOut || nodeCount >= this.maxNodes || txCount >= this.maxTxs)
                        break;
                    fanned++;
                    txCount++;
                    this.persistEdge(traceId, tx);
                    const toKey = tx.to.toLowerCase();
                    if (visited.has(toKey))
                        continue;
                    visited.add(toKey);
                    const label = this.persistNode(traceId, tx.to, chain, nextDepth);
                    nodeCount++;
                    maxDepthReached = Math.max(maxDepthReached, nextDepth);
                    if (!this.isTerminal(label) && nextDepth < this.maxHops) {
                        queue.push({ address: tx.to, depth: nextDepth });
                    }
                }
            }
            console.log(`[TraceService] Trace ${traceId} complete: ${nodeCount} nodes, ${txCount} txs, depth ${maxDepthReached}`);
            return traceRepository.save({
                ...updatedReq,
                hopsTraced: maxDepthReached,
                status: TraceStatus.COMPLETED,
                completedAt: new Date().toISOString(),
            });
        }
        catch (error) {
            console.error(`[TraceService] Trace ${traceId} failed at address ${root}:`, error);
            return traceRepository.save({
                ...updatedReq,
                status: TraceStatus.FAILED,
                failureReason: error.message || String(error),
                hopsTraced: maxDepthReached,
            });
        }
    }
    persistNode(traceId, address, chain, depth) {
        const label = labelRepository.findByAddressIgnoreCaseAndChain(address, chain);
        const type = label ? label.labelType : LabelType.UNLABELED;
        graphRepository.saveNode({
            traceId,
            address,
            hopDepth: depth,
            labelType: type,
            labelConfidence: label?.confidence ?? null,
            partialData: false,
        });
        return type;
    }
    persistEdge(traceId, tx) {
        graphRepository.saveEdge({
            traceId,
            fromAddress: tx.from,
            toAddress: tx.to,
            txHash: tx.hash,
            amount: tx.amount,
            txTimestamp: tx.timestamp,
        });
    }
    isTerminal(type) {
        return type === LabelType.EXCHANGE || type === LabelType.MIXER;
    }
}
