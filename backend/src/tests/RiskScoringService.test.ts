import { RiskScoringService } from "../services/RiskScoringService.js";
import { LabelType, TraceStatus } from "../types/index.js";

describe("RiskScoringService", () => {
  it("should return LOW risk for empty trace", () => {
    const service = new RiskScoringService();
    const result = service.score({
      id: "test", walletAddress: "0x123", chain: "ethereum", status: TraceStatus.COMPLETED, requestedAt: new Date().toISOString()
    }, [], []);
    
    expect(result.category).toBe("LOW");
    expect(result.score).toBe(0);
  });
});
