import { db } from "../database.js";
import { TraceRequest, TraceStatus } from "../../types/index.js";

export class TraceRepository {
  findById(id: string): TraceRequest | undefined {
    const stmt = db.prepare(`
      SELECT id, case_id as caseId, wallet_address as walletAddress, chain, status,
             hops_traced as hopsTraced, risk_score as riskScore, flagged_patterns as flaggedPatterns,
             requested_at as requestedAt, completed_at as completedAt, failure_reason as failureReason
      FROM trace_requests WHERE id = ?
    `);
    return stmt.get(id) as TraceRequest | undefined;
  }

  findByWalletAddressIgnoreCaseAndChainAndStatusIn(address: string, chain: string, statuses: TraceStatus[]): TraceRequest[] {
    const placeholders = statuses.map(() => "?").join(",");
    const stmt = db.prepare(`
      SELECT id, case_id as caseId, wallet_address as walletAddress, chain, status,
             hops_traced as hopsTraced, risk_score as riskScore, flagged_patterns as flaggedPatterns,
             requested_at as requestedAt, completed_at as completedAt, failure_reason as failureReason
      FROM trace_requests
      WHERE LOWER(wallet_address) = LOWER(?) AND chain = ? AND status IN (${placeholders})
    `);
    return stmt.all(address, chain, ...statuses) as TraceRequest[];
  }

  save(req: Partial<TraceRequest> & { walletAddress: string; chain: string; status: TraceStatus }): TraceRequest {
    const id = req.id || crypto.randomUUID();
    const requestedAt = req.requestedAt || new Date().toISOString();
    const existing = req.id ? this.findById(req.id) : undefined;

    if (existing) {
      const stmt = db.prepare(`
        UPDATE trace_requests
        SET case_id = ?, wallet_address = ?, chain = ?, status = ?, hops_traced = ?, risk_score = ?, flagged_patterns = ?, completed_at = ?, failure_reason = ?
        WHERE id = ?
      `);
      stmt.run(
        req.caseId ?? existing.caseId ?? null,
        req.walletAddress,
        req.chain,
        req.status,
        req.hopsTraced ?? existing.hopsTraced ?? null,
        req.riskScore ?? existing.riskScore ?? null,
        req.flaggedPatterns ?? existing.flaggedPatterns ?? null,
        req.completedAt ?? existing.completedAt ?? null,
        req.failureReason ?? existing.failureReason ?? null,
        id
      );
    } else {
      const stmt = db.prepare(`
        INSERT INTO trace_requests (id, case_id, wallet_address, chain, status, hops_traced, risk_score, flagged_patterns, requested_at, completed_at, failure_reason)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run(
        id,
        req.caseId || null,
        req.walletAddress,
        req.chain,
        req.status,
        req.hopsTraced ?? null,
        req.riskScore ?? null,
        req.flaggedPatterns || null,
        requestedAt,
        req.completedAt || null,
        req.failureReason || null
      );
    }
    return this.findById(id)!;
  }
}

export const traceRepository = new TraceRepository();
