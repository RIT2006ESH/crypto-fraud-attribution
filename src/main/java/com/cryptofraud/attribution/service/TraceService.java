package com.cryptofraud.attribution.service;

import com.cryptofraud.attribution.chain.ChainClient;
import com.cryptofraud.attribution.chain.ChainTransaction;
import com.cryptofraud.attribution.entity.*;
import com.cryptofraud.attribution.repository.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Bounded breadth-first trace over outgoing fund flow.
 *
 * Starts at the reported wallet, follows the money forward hop by hop, records
 * every address as a GraphNode and every transfer as a GraphEdge, and stops
 * expanding a branch once it reaches an exchange or mixer (a cash-out / laundering
 * boundary). Bounded on three axes so it can never run away: max hops, max fan-out
 * per node, and a global node cap.
 */
@Service
public class TraceService {

    private static final Logger log = LoggerFactory.getLogger(TraceService.class);

    private final Map<String, ChainClient> clientsByChain;
    private final AddressLabelRepository addressLabelRepository;
    private final TraceRequestRepository traceRequestRepository;
    private final GraphNodeRepository graphNodeRepository;
    private final GraphEdgeRepository graphEdgeRepository;

    private final int maxHops;
    private final int maxFanOut;
    private final int maxNodes;

    public TraceService(List<ChainClient> chainClients,
                        AddressLabelRepository addressLabelRepository,
                        TraceRequestRepository traceRequestRepository,
                        GraphNodeRepository graphNodeRepository,
                        GraphEdgeRepository graphEdgeRepository,
                        @Value("${trace.max-hops:5}") int maxHops,
                        @Value("${trace.max-fanout:20}") int maxFanOut,
                        @Value("${trace.max-nodes:200}") int maxNodes) {
        this.clientsByChain = chainClients.stream()
                .collect(Collectors.toMap(ChainClient::chain, Function.identity()));
        this.addressLabelRepository = addressLabelRepository;
        this.traceRequestRepository = traceRequestRepository;
        this.graphNodeRepository = graphNodeRepository;
        this.graphEdgeRepository = graphEdgeRepository;
        this.maxHops = maxHops;
        this.maxFanOut = maxFanOut;
        this.maxNodes = maxNodes;
    }

    /**
     * Runs the trace for the given (already-persisted) request, updating it in place
     * with status, hops traced, and the persisted graph. Never throws — failures are
     * recorded on the request as status=FAILED.
     */
    public TraceRequest trace(TraceRequest request) {
        ChainClient client = clientsByChain.get(request.getChain());
        if (client == null) {
            request.setStatus(TraceStatus.FAILED);
            request.setFailureReason("Unsupported chain: " + request.getChain());
            return traceRequestRepository.save(request);
        }

        request.setStatus(TraceStatus.TRACING);
        traceRequestRepository.save(request);

        final String traceId = request.getId();
        final String chain = request.getChain();
        final String root = request.getWalletAddress();

        Set<String> visited = new HashSet<>();
        Deque<Hop> queue = new ArrayDeque<>();
        int maxDepthReached = 0;
        int nodeCount = 0;

        try {
            AddressLabel.LabelType rootLabel = persistNode(traceId, root, chain, 0);
            visited.add(root.toLowerCase());
            nodeCount++;
            if (!isTerminal(rootLabel)) {
                queue.add(new Hop(root, 0));
            }

            while (!queue.isEmpty() && nodeCount < maxNodes) {
                Hop hop = queue.poll();
                if (hop.depth() >= maxHops) {
                    continue;
                }
                int nextDepth = hop.depth() + 1;

                // Follow the largest transfers first — fraud proceeds usually move as
                // a few big transfers, not thousands of dust transactions.
                List<ChainTransaction> outgoing =
                        new ArrayList<>(client.getOutgoingTransactions(hop.address()));
                outgoing.sort(Comparator.comparing(ChainTransaction::amount).reversed());

                int fanned = 0;
                for (ChainTransaction tx : outgoing) {
                    if (fanned >= maxFanOut || nodeCount >= maxNodes) {
                        break;
                    }
                    fanned++;
                    persistEdge(traceId, tx);   // record edge even to seen nodes (shows convergence)

                    String toKey = tx.toAddress().toLowerCase();
                    if (visited.contains(toKey)) {
                        continue;               // don't duplicate the node or re-expand
                    }
                    visited.add(toKey);

                    AddressLabel.LabelType label = persistNode(traceId, tx.toAddress(), chain, nextDepth);
                    nodeCount++;
                    maxDepthReached = Math.max(maxDepthReached, nextDepth);

                    if (!isTerminal(label) && nextDepth < maxHops) {
                        queue.add(new Hop(tx.toAddress(), nextDepth));
                    }
                }
            }

            request.setHopsTraced(maxDepthReached);
            request.setStatus(TraceStatus.COMPLETED);
            request.setCompletedAt(Instant.now());
            log.info("Trace {} complete: {} nodes, depth {}", traceId, nodeCount, maxDepthReached);
            return traceRequestRepository.save(request);

        } catch (Exception e) {
            log.error("Trace {} failed at address {}: {}", traceId, root, e.getMessage(), e);
            request.setStatus(TraceStatus.FAILED);
            request.setFailureReason(e.getMessage());
            request.setHopsTraced(maxDepthReached);
            return traceRequestRepository.save(request);
        }
    }

    private AddressLabel.LabelType persistNode(String traceId, String address, String chain, int depth) {
        Optional<AddressLabel> label = addressLabelRepository.findByAddressIgnoreCaseAndChain(address, chain);
        AddressLabel.LabelType type = label.map(AddressLabel::getLabelType)
                .orElse(AddressLabel.LabelType.UNLABELED);

        GraphNode node = GraphNode.builder()
                .traceId(traceId)
                .address(address)
                .hopDepth(depth)
                .labelType(type)
                .labelConfidence(label.map(AddressLabel::getConfidence).orElse(null))
                .partialData(false)
                .build();
        graphNodeRepository.save(node);
        return type;
    }

    private void persistEdge(String traceId, ChainTransaction tx) {
        GraphEdge edge = GraphEdge.builder()
                .traceId(traceId)
                .fromAddress(tx.fromAddress())
                .toAddress(tx.toAddress())
                .txHash(tx.txHash())
                .amount(tx.amount())
                .txTimestamp(tx.timestamp())
                .build();
        graphEdgeRepository.save(edge);
    }

    private boolean isTerminal(AddressLabel.LabelType type) {
        // An exchange = likely cash-out point; a mixer = laundering boundary.
        // Either way, addresses beyond it belong to the service, not the fraudster.
        return type == AddressLabel.LabelType.EXCHANGE || type == AddressLabel.LabelType.MIXER;
    }

    private record Hop(String address, int depth) {}
}
