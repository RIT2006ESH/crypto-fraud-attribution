import { config } from "../config.js";
import { LabelType } from "../types/index.js";
const W_ROOT_SANCTIONED = 40;
const W_SANCTIONED_DOWNSTREAM = 45;
const W_MIXER = 45;
const W_EXCHANGE_CASHOUT = 15;
const W_LAYERING = 20;
const W_HIGH_FANOUT = 15;
const W_CONVERGENCE = 10;
const FANOUT_THRESHOLD = 5;
const CONVERGENCE_THRESHOLD = 3;
const LAYERING_HOPS = 3;
export class RiskScoringService {
    maxFanOut;
    constructor() {
        this.maxFanOut = config.trace.maxFanOut;
    }
    score(request, nodes, edges) {
        let score = 0;
        const patterns = [];
        const root = (request.walletAddress || "").toLowerCase();
        const rootNode = nodes.find((n) => n.address && n.address.toLowerCase() === root);
        const rootLabel = rootNode?.labelType || null;
        const downstream = nodes.filter((n) => n.hopDepth !== undefined && n.hopDepth > 0);
        if (rootLabel === LabelType.SANCTIONED) {
            score += W_ROOT_SANCTIONED;
            patterns.push("The reported wallet is itself on a sanctions list");
        }
        if (downstream.some((n) => n.labelType === LabelType.SANCTIONED)) {
            score += W_SANCTIONED_DOWNSTREAM;
            patterns.push("Funds moved onward to a sanctioned address");
        }
        if (downstream.some((n) => n.labelType === LabelType.MIXER)) {
            score += W_MIXER;
            patterns.push("Funds routed through a mixer or tumbler");
        }
        const exchangeNodes = downstream.filter((n) => n.labelType === LabelType.EXCHANGE);
        let nearestExchange = null;
        if (exchangeNodes.length > 0) {
            nearestExchange = exchangeNodes.reduce((min, cur) => (cur.hopDepth < min.hopDepth ? cur : min));
        }
        if (nearestExchange) {
            score += W_EXCHANGE_CASHOUT;
            const depthStr = nearestExchange.hopDepth === 1 ? "1 hop away" : `${nearestExchange.hopDepth} hops away`;
            patterns.push(`Cash-out point reached at an exchange ${depthStr}`);
        }
        const maxDepth = nodes.reduce((max, n) => Math.max(max, n.hopDepth || 0), 0);
        const exchangeFarOrAbsent = !nearestExchange || nearestExchange.hopDepth >= LAYERING_HOPS;
        if (maxDepth >= LAYERING_HOPS && exchangeFarOrAbsent) {
            score += W_LAYERING;
            patterns.push(`Funds layered across ${maxDepth} hops before any cash-out`);
        }
        // Distinct counterparties
        const sentTo = new Map();
        const receivedFrom = new Map();
        for (const e of edges) {
            if (!e.fromAddress || !e.toAddress)
                continue;
            const from = e.fromAddress.toLowerCase();
            const to = e.toAddress.toLowerCase();
            if (!sentTo.has(from))
                sentTo.set(from, new Set());
            sentTo.get(from).add(to);
            if (!receivedFrom.has(to))
                receivedFrom.set(to, new Set());
            receivedFrom.get(to).add(from);
        }
        let widestSplit = 0;
        for (const set of sentTo.values()) {
            if (set.size > widestSplit)
                widestSplit = set.size;
        }
        let deepestFunnel = 0;
        for (const set of receivedFrom.values()) {
            if (set.size > deepestFunnel)
                deepestFunnel = set.size;
        }
        if (widestSplit >= FANOUT_THRESHOLD) {
            score += W_HIGH_FANOUT;
            patterns.push(widestSplit >= this.maxFanOut
                ? `Funds split across at least ${widestSplit} addresses, the trace fan-out limit (structuring)`
                : `Funds split across ${widestSplit} addresses (structuring)`);
        }
        if (deepestFunnel >= CONVERGENCE_THRESHOLD) {
            score += W_CONVERGENCE;
            patterns.push(`Funds from ${deepestFunnel} different addresses converge on a single wallet`);
        }
        if (patterns.length === 0) {
            patterns.push("No high-risk patterns detected");
        }
        score = Math.min(score, 100);
        return {
            score,
            category: RiskScoringService.categorize(score),
            patterns,
        };
    }
    static categorize(score) {
        if (score === undefined || score === null)
            return null;
        if (score >= 75)
            return "CRITICAL";
        if (score >= 50)
            return "HIGH";
        if (score >= 25)
            return "MEDIUM";
        return "LOW";
    }
}
