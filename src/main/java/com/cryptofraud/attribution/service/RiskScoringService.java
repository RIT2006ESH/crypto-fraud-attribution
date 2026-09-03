package com.cryptofraud.attribution.service;

import com.cryptofraud.attribution.entity.AddressLabel;
import com.cryptofraud.attribution.entity.GraphEdge;
import com.cryptofraud.attribution.entity.GraphNode;
import com.cryptofraud.attribution.entity.TraceRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Rule-based, explainable risk scoring over a traced graph. Each rule that fires
 * adds weight and a plain-English reason; the final score (0-100) maps to a band.
 * No ML, so an investigator can state in court exactly why a wallet scored as it did.
 *
 * Two things this deliberately gets right: degrees are counted over DISTINCT
 * counterparties rather than transactions, and the reported wallet's own label is
 * treated as a separate finding from what it sent funds to.
 */
@Service
public class RiskScoringService {

    private static final int W_ROOT_SANCTIONED = 40;
    private static final int W_SANCTIONED_DOWNSTREAM = 45;
    private static final int W_MIXER = 45;
    private static final int W_EXCHANGE_CASHOUT = 15;
    private static final int W_LAYERING = 20;
    private static final int W_HIGH_FANOUT = 15;
    private static final int W_CONVERGENCE = 10;

    private static final int FANOUT_THRESHOLD = 5;
    private static final int CONVERGENCE_THRESHOLD = 3;
    private static final int LAYERING_HOPS = 3;

    private final int maxFanOut;

    public RiskScoringService(@Value("${trace.max-fanout:20}") int maxFanOut) {
        this.maxFanOut = maxFanOut;
    }

    public Result score(TraceRequest request, List<GraphNode> nodes, List<GraphEdge> edges) {
        int score = 0;
        List<String> patterns = new ArrayList<>();
        String root = request.getWalletAddress() == null
                ? "" : request.getWalletAddress().toLowerCase();

        // The reported wallet's own label is a given, not a discovery.
        nodes.stream()
                .filter(n -> n.getAddress() != null && n.getAddress().toLowerCase().equals(root))
                .map(GraphNode::getLabelType)
                .findFirst()
                .ifPresent(t -> { /* handled below */ });

        AddressLabel.LabelType rootLabel = nodes.stream()
                .filter(n -> n.getAddress() != null && n.getAddress().toLowerCase().equals(root))
                .map(GraphNode::getLabelType)
                .findFirst()
                .orElse(null);

        List<GraphNode> downstream = nodes.stream()
                .filter(n -> n.getHopDepth() != null && n.getHopDepth() > 0)
                .toList();

        if (rootLabel == AddressLabel.LabelType.SANCTIONED) {
            score += W_ROOT_SANCTIONED;
            patterns.add("The reported wallet is itself on a sanctions list");
        }

        if (downstream.stream().anyMatch(n -> n.getLabelType() == AddressLabel.LabelType.SANCTIONED)) {
            score += W_SANCTIONED_DOWNSTREAM;
            patterns.add("Funds moved onward to a sanctioned address");
        }
        if (downstream.stream().anyMatch(n -> n.getLabelType() == AddressLabel.LabelType.MIXER)) {
            score += W_MIXER;
            patterns.add("Funds routed through a mixer or tumbler");
        }

        GraphNode nearestExchange = downstream.stream()
                .filter(n -> n.getLabelType() == AddressLabel.LabelType.EXCHANGE)
                .min(Comparator.comparing(GraphNode::getHopDepth))
                .orElse(null);
        if (nearestExchange != null) {
            score += W_EXCHANGE_CASHOUT;
            patterns.add("Cash-out point reached at an exchange "
                    + nearestExchange.getHopDepth()
                    + (nearestExchange.getHopDepth() == 1 ? " hop away" : " hops away"));
        }

        int maxDepth = nodes.stream()
                .map(GraphNode::getHopDepth)
                .filter(d -> d != null)
                .max(Integer::compareTo).orElse(0);
        boolean exchangeFarOrAbsent = nearestExchange == null
                || nearestExchange.getHopDepth() >= LAYERING_HOPS;
        if (maxDepth >= LAYERING_HOPS && exchangeFarOrAbsent) {
            score += W_LAYERING;
            patterns.add("Funds layered across " + maxDepth + " hops before any cash-out");
        }

        // Distinct counterparties, not transaction counts.
        Map<String, Set<String>> sentTo = new HashMap<>();
        Map<String, Set<String>> receivedFrom = new HashMap<>();
        for (GraphEdge e : edges) {
            if (e.getFromAddress() == null || e.getToAddress() == null) continue;
            String from = e.getFromAddress().toLowerCase();
            String to = e.getToAddress().toLowerCase();
            sentTo.computeIfAbsent(from, k -> new HashSet<>()).add(to);
            receivedFrom.computeIfAbsent(to, k -> new HashSet<>()).add(from);
        }
        int widestSplit = sentTo.values().stream().mapToInt(Set::size).max().orElse(0);
        int deepestFunnel = receivedFrom.values().stream().mapToInt(Set::size).max().orElse(0);

        if (widestSplit >= FANOUT_THRESHOLD) {
            score += W_HIGH_FANOUT;
            // At the cap we only know it is "at least" this wide, so say so.
            patterns.add(widestSplit >= maxFanOut
                    ? "Funds split across at least " + widestSplit
                        + " addresses, the trace fan-out limit (structuring)"
                    : "Funds split across " + widestSplit + " addresses (structuring)");
        }
        if (deepestFunnel >= CONVERGENCE_THRESHOLD) {
            score += W_CONVERGENCE;
            patterns.add("Funds from " + deepestFunnel
                    + " different addresses converge on a single wallet");
        }

        if (patterns.isEmpty()) {
            patterns.add("No high-risk patterns detected");
        }
        score = Math.min(score, 100);
        return new Result(score, categorize(score), patterns);
    }

    /** Maps a 0-100 score to a band. Null-safe for not-yet-scored requests. */
    public static String categorize(Integer score) {
        if (score == null) return null;
        if (score >= 75) return "CRITICAL";
        if (score >= 50) return "HIGH";
        if (score >= 25) return "MEDIUM";
        return "LOW";
    }

    public record Result(int score, String category, List<String> patterns) {}
}
