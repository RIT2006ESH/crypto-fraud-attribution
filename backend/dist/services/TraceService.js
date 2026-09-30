import { config } from "../config.js";
import { graphEdgeRepository, graphNodeRepository, traceRequestRepository } from "../db/database.js";
import { EvmChainClient } from "../chain/EvmChainClient.js";
import { TronChainClient } from "../chain/TronChainClient.js";
import { EtherscanApiError } from "../chain/EtherscanClient.js";
import { TronGridApiError } from "../chain/TronGridClient.js";
import { LabelService } from "../labels/LabelService.js";
import { LabelType, TraceStatus } from "../types/index.js";
/** Cap the extra label lookups one trace may spend, so latency stays bounded. */
const ENRICHMENT_BUDGET_MULTIPLIER = 2;
export class TraceService {
    clientsByChain;
    labelService;
    maxHops;
    maxFanOut;
    maxNodes;
    constructor(labelService = new LabelService()) {
        this.clientsByChain = new Map();
        const ethClient = new EvmChainClient("ethereum", config.etherscan.chainId);
        this.clientsByChain.set(ethClient.chain(), ethClient);
        const polygonClient = new EvmChainClient("polygon", 137);
        this.clientsByChain.set(polygonClient.chain(), polygonClient);
        const tronClient = new TronChainClient();
        this.clientsByChain.set(tronClient.chain(), tronClient);
        this.labelService = labelService;
        this.maxHops = config.trace.maxHops;
        this.maxFanOut = config.trace.maxFanOut;
        this.maxNodes = config.trace.maxNodes;
    }
    async trace(request) {
        const client = this.clientsByChain.get(request.chain.toLowerCase());
        if (!client) {
            return traceRequestRepository.save({
                ...request,
                status: TraceStatus.FAILED,
                failureReason: `Unsupported chain: ${request.chain}`,
            });
        }
        const updatedReq = traceRequestRepository.save({ ...request, status: TraceStatus.TRACING });
        const traceId = updatedReq.id;
        const chain = updatedReq.chain;
        const root = updatedReq.walletAddress;
        const visited = new Set();
        const queue = [];
        let maxDepthReached = 0;
        let nodeCount = 0;
        let enrichmentsLeft = this.maxNodes * ENRICHMENT_BUDGET_MULTIPLIER;
        const label = async (address) => {
            const enrich = enrichmentsLeft > 0;
            if (enrich)
                enrichmentsLeft--;
            return this.labelService.resolve(address, chain, { enrich });
        };
        try {
            const rootLabel = await label(root);
            this.persistNode(traceId, root, 0, rootLabel);
            visited.add(root.toLowerCase());
            nodeCount++;
            if (!this.isTerminal(rootLabel.labelType)) {
                queue.push({ address: root, depth: 0 });
            }
            while (queue.length > 0 && nodeCount < this.maxNodes) {
                const hop = queue.shift();
                if (hop.depth >= this.maxHops)
                    continue;
                const nextDepth = hop.depth + 1;
                const outgoing = await client.getOutgoingTransactions(hop.address);
                let fanned = 0;
                for (const tx of outgoing) {
                    if (fanned >= this.maxFanOut || nodeCount >= this.maxNodes)
                        break;
                    fanned++;
                    // Record the edge even to an already-seen node — convergence is a signal.
                    this.persistEdge(traceId, tx);
                    const toKey = tx.toAddress.toLowerCase();
                    if (visited.has(toKey))
                        continue;
                    visited.add(toKey);
                    const resolved = await label(tx.toAddress);
                    this.persistNode(traceId, tx.toAddress, nextDepth, resolved);
                    nodeCount++;
                    maxDepthReached = Math.max(maxDepthReached, nextDepth);
                    if (!this.isTerminal(resolved.labelType) && nextDepth < this.maxHops) {
                        queue.push({ address: tx.toAddress, depth: nextDepth });
                    }
                }
            }
            console.log(`[TraceService] trace ${traceId}: ${nodeCount} nodes, depth ${maxDepthReached}`);
            return traceRequestRepository.save({
                ...updatedReq,
                hopsTraced: maxDepthReached,
                status: TraceStatus.COMPLETED,
                completedAt: new Date().toISOString(),
            });
        }
        catch (error) {
            const reason = this.describeError(error);
            console.error(`[TraceService] trace ${traceId} failed at ${root}: ${reason}`);
            return traceRequestRepository.save({
                ...updatedReq,
                status: TraceStatus.FAILED,
                failureReason: reason,
                hopsTraced: maxDepthReached,
            });
        }
    }
    persistNode(traceId, address, depth, label) {
        graphNodeRepository.save({
            traceId,
            address,
            hopDepth: depth,
            labelType: label.labelType,
            labelConfidence: label.confidence,
            partialData: false,
        });
    }
    persistEdge(traceId, tx) {
        graphEdgeRepository.save({
            traceId,
            fromAddress: tx.fromAddress,
            toAddress: tx.toAddress,
            txHash: tx.txHash,
            amount: tx.amount,
            txTimestamp: tx.timestamp,
            tokenSymbol: tx.tokenSymbol ?? null,
            tokenAddress: tx.tokenAddress ?? null,
            transferType: tx.transferType,
        });
    }
    isTerminal(type) {
        return type === LabelType.EXCHANGE || type === LabelType.MIXER;
    }
    describeError(error) {
        if (error instanceof EtherscanApiError)
            return error.message;
        if (error instanceof TronGridApiError)
            return error.message;
        if (error instanceof Error)
            return error.message;
        return String(error);
    }
}
