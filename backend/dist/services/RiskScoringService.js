import { config } from "../config/index.js";
import { LabelType } from "../types/index.js";
const W_SANCTIONED = 50;
const W_MIXER = 40;
const W_RAPID_FORWARDING = 20;
const W_EXCHANGE = 15;
const W_MULTI_HOP = 10;
export class RiskScoringService {
    maxFanOut;
    constructor() {
        this.maxFanOut = config.trace.maxFanOut;
    }
    score(request, nodes, edges) {
        let score = 0;
        const reasons = [];
        const root = (request.walletAddress || "").toLowerCase();
        const rootNode = nodes.find((n) => n.address && n.address.toLowerCase() === root);
        const rootLabel = rootNode?.labelType || null;
        const downstream = nodes.filter((n) => n.hopDepth !== undefined && n.hopDepth > 0);
        if (rootLabel === LabelType.SANCTIONED || downstream.some((n) => n.labelType === LabelType.SANCTIONED)) {
            score += W_SANCTIONED;
            reasons.push("Sanctioned wallet detected");
        }
        if (downstream.some((n) => n.labelType === LabelType.MIXER)) {
            score += W_MIXER;
            reasons.push("Mixer detected");
        }
        if (downstream.some((n) => n.labelType === LabelType.EXCHANGE)) {
            score += W_EXCHANGE;
            reasons.push("Exchange reached");
        }
        const maxDepth = nodes.reduce((max, n) => Math.max(max, n.hopDepth || 0), 0);
        if (maxDepth >= 3) {
            score += W_MULTI_HOP;
            reasons.push(`Multi-hop layering (${maxDepth} hops)`);
        }
        // Check for rapid forwarding timestamp delta (transfers within 10 minutes)
        const sortedEdges = [...edges].filter((e) => e.txTimestamp).sort((a, b) => {
            return new Date(a.txTimestamp).getTime() - new Date(b.txTimestamp).getTime();
        });
        let rapidDetected = false;
        for (let i = 1; i < sortedEdges.length; i++) {
            const diffMs = new Date(sortedEdges[i].txTimestamp).getTime() - new Date(sortedEdges[i - 1].txTimestamp).getTime();
            if (diffMs > 0 && diffMs <= 10 * 60 * 1000) {
                rapidDetected = true;
                break;
            }
        }
        if (rapidDetected) {
            score += W_RAPID_FORWARDING;
            reasons.push("Rapid forwarding pattern detected");
        }
        if (reasons.length === 0) {
            reasons.push("No high-risk patterns detected");
        }
        score = Math.min(score, 100);
        const level = RiskScoringService.categorize(score);
        return {
            score,
            level,
            category: level,
            reasons,
            patterns: reasons,
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
