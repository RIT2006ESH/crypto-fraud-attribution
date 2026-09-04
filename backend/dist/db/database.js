import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { config } from "../config.js";
const dbDir = path.dirname(config.dbPath);
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}
export const db = new Database(config.dbPath);
db.pragma("journal_mode = WAL");
export function initDatabase() {
    db.exec(`
    CREATE TABLE IF NOT EXISTS address_labels (
      id TEXT PRIMARY KEY,
      address TEXT NOT NULL,
      chain TEXT NOT NULL,
      label_type TEXT NOT NULL,
      entity_name TEXT,
      source TEXT,
      confidence REAL,
      updated_at TEXT,
      UNIQUE(address, chain)
    );

    CREATE TABLE IF NOT EXISTS trace_requests (
      id TEXT PRIMARY KEY,
      case_id TEXT,
      wallet_address TEXT NOT NULL,
      chain TEXT NOT NULL,
      status TEXT NOT NULL,
      hops_traced INTEGER,
      risk_score INTEGER,
      flagged_patterns TEXT,
      requested_at TEXT NOT NULL,
      completed_at TEXT,
      failure_reason TEXT
    );

    CREATE TABLE IF NOT EXISTS graph_nodes (
      id TEXT PRIMARY KEY,
      trace_id TEXT NOT NULL,
      address TEXT NOT NULL,
      hop_depth INTEGER NOT NULL,
      label_type TEXT,
      label_confidence REAL,
      partial_data INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS graph_edges (
      id TEXT PRIMARY KEY,
      trace_id TEXT NOT NULL,
      from_address TEXT NOT NULL,
      to_address TEXT NOT NULL,
      tx_hash TEXT NOT NULL,
      amount TEXT,
      tx_timestamp TEXT,
      token_symbol TEXT,
      token_address TEXT,
      transfer_type TEXT NOT NULL DEFAULT 'native'
    );

    CREATE INDEX IF NOT EXISTS idx_graph_nodes_trace ON graph_nodes(trace_id);
    CREATE INDEX IF NOT EXISTS idx_graph_edges_trace ON graph_edges(trace_id);
    CREATE INDEX IF NOT EXISTS idx_trace_requests_wallet ON trace_requests(wallet_address, chain, status);
    CREATE INDEX IF NOT EXISTS idx_address_labels_lookup ON address_labels(chain, address);
  `);
    migrate();
}
/** Additive migrations for databases created before a column existed. */
function migrate() {
    const labelColumns = db.prepare("PRAGMA table_info(address_labels)").all();
    if (!labelColumns.some((c) => c.name === "updated_at")) {
        db.exec("ALTER TABLE address_labels ADD COLUMN updated_at TEXT");
        console.log("[database] migrated address_labels: added updated_at");
    }
    const edgeColumns = db.prepare("PRAGMA table_info(graph_edges)").all();
    if (!edgeColumns.some((c) => c.name === "token_symbol")) {
        db.exec("ALTER TABLE graph_edges ADD COLUMN token_symbol TEXT");
        console.log("[database] migrated graph_edges: added token_symbol");
    }
    if (!edgeColumns.some((c) => c.name === "token_address")) {
        db.exec("ALTER TABLE graph_edges ADD COLUMN token_address TEXT");
        console.log("[database] migrated graph_edges: added token_address");
    }
    if (!edgeColumns.some((c) => c.name === "transfer_type")) {
        db.exec("ALTER TABLE graph_edges ADD COLUMN transfer_type TEXT NOT NULL DEFAULT 'native'");
        console.log("[database] migrated graph_edges: added transfer_type");
    }
}
// Repositories
export const addressLabelRepository = {
    findByAddressIgnoreCaseAndChain(address, chain) {
        const stmt = db.prepare("SELECT id, address, chain, label_type as labelType, entity_name as entityName, source, confidence, updated_at as updatedAt FROM address_labels WHERE LOWER(address) = LOWER(?) AND chain = ?");
        return stmt.get(address, chain);
    },
    /**
     * Cache read that respects a TTL. Returns undefined when the row is missing or stale,
     * which is the signal for LabelService to go back out to Etherscan.
     */
    findFresh(address, chain, ttlHours) {
        const row = this.findByAddressIgnoreCaseAndChain(address, chain);
        if (!row)
            return undefined;
        if (ttlHours <= 0)
            return row;
        if (!row.updatedAt)
            return undefined;
        const ageMs = Date.now() - new Date(row.updatedAt).getTime();
        if (!Number.isFinite(ageMs) || ageMs > ttlHours * 3_600_000)
            return undefined;
        return row;
    },
    save(label) {
        const id = label.id || crypto.randomUUID();
        const updatedAt = label.updatedAt || new Date().toISOString();
        const stmt = db.prepare(`
      INSERT INTO address_labels (id, address, chain, label_type, entity_name, source, confidence, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(address, chain) DO UPDATE SET
        label_type = excluded.label_type,
        entity_name = excluded.entity_name,
        source = excluded.source,
        confidence = excluded.confidence,
        updated_at = excluded.updated_at
    `);
        stmt.run(id, label.address, label.chain, label.labelType, label.entityName ?? null, label.source ?? null, label.confidence ?? null, updatedAt);
        return { ...label, id, updatedAt };
    },
};
export const traceRequestRepository = {
    findById(id) {
        const stmt = db.prepare(`
      SELECT id, case_id as caseId, wallet_address as walletAddress, chain, status,
             hops_traced as hopsTraced, risk_score as riskScore, flagged_patterns as flaggedPatterns,
             requested_at as requestedAt, completed_at as completedAt, failure_reason as failureReason
      FROM trace_requests WHERE id = ?
    `);
        return stmt.get(id);
    },
    findByWalletAddressIgnoreCaseAndChainAndStatusIn(address, chain, statuses) {
        const placeholders = statuses.map(() => "?").join(",");
        const stmt = db.prepare(`
      SELECT id, case_id as caseId, wallet_address as walletAddress, chain, status,
             hops_traced as hopsTraced, risk_score as riskScore, flagged_patterns as flaggedPatterns,
             requested_at as requestedAt, completed_at as completedAt, failure_reason as failureReason
      FROM trace_requests
      WHERE LOWER(wallet_address) = LOWER(?) AND chain = ? AND status IN (${placeholders})
    `);
        return stmt.all(address, chain, ...statuses);
    },
    findAll(limit = 50, offset = 0) {
        const stmt = db.prepare(`
      SELECT id, case_id as caseId, wallet_address as walletAddress, chain, status,
             hops_traced as hopsTraced, risk_score as riskScore, flagged_patterns as flaggedPatterns,
             requested_at as requestedAt, completed_at as completedAt, failure_reason as failureReason
      FROM trace_requests
      ORDER BY requested_at DESC
      LIMIT ? OFFSET ?
    `);
        return stmt.all(limit, offset);
    },
    save(req) {
        const id = req.id || crypto.randomUUID();
        const requestedAt = req.requestedAt || new Date().toISOString();
        const existing = req.id ? this.findById(req.id) : undefined;
        if (existing) {
            const stmt = db.prepare(`
        UPDATE trace_requests
        SET case_id = ?, wallet_address = ?, chain = ?, status = ?, hops_traced = ?, risk_score = ?, flagged_patterns = ?, completed_at = ?, failure_reason = ?
        WHERE id = ?
      `);
            stmt.run(req.caseId ?? existing.caseId ?? null, req.walletAddress, req.chain, req.status, req.hopsTraced ?? existing.hopsTraced ?? null, req.riskScore ?? existing.riskScore ?? null, req.flaggedPatterns ?? existing.flaggedPatterns ?? null, req.completedAt ?? existing.completedAt ?? null, req.failureReason ?? existing.failureReason ?? null, id);
        }
        else {
            const stmt = db.prepare(`
        INSERT INTO trace_requests (id, case_id, wallet_address, chain, status, hops_traced, risk_score, flagged_patterns, requested_at, completed_at, failure_reason)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
            stmt.run(id, req.caseId || null, req.walletAddress, req.chain, req.status, req.hopsTraced ?? null, req.riskScore ?? null, req.flaggedPatterns || null, requestedAt, req.completedAt || null, req.failureReason || null);
        }
        return this.findById(id);
    },
};
export const graphNodeRepository = {
    findByTraceId(traceId) {
        const stmt = db.prepare(`
      SELECT id, trace_id as traceId, address, hop_depth as hopDepth, label_type as labelType, label_confidence as labelConfidence, partial_data as partialData
      FROM graph_nodes WHERE trace_id = ?
    `);
        const rows = stmt.all(traceId);
        return rows.map((r) => ({
            ...r,
            partialData: Boolean(r.partialData),
        }));
    },
    save(node) {
        const id = node.id || crypto.randomUUID();
        const stmt = db.prepare(`
      INSERT INTO graph_nodes (id, trace_id, address, hop_depth, label_type, label_confidence, partial_data)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
        stmt.run(id, node.traceId, node.address, node.hopDepth, node.labelType || null, node.labelConfidence ?? null, node.partialData ? 1 : 0);
        return { ...node, id };
    },
};
export const graphEdgeRepository = {
    findByTraceId(traceId) {
        const stmt = db.prepare(`
      SELECT id, trace_id as traceId, from_address as fromAddress, to_address as toAddress,
             tx_hash as txHash, amount, tx_timestamp as txTimestamp,
             token_symbol as tokenSymbol, token_address as tokenAddress, transfer_type as transferType
      FROM graph_edges WHERE trace_id = ?
    `);
        return stmt.all(traceId);
    },
    save(edge) {
        const id = edge.id || crypto.randomUUID();
        const stmt = db.prepare(`
      INSERT INTO graph_edges (id, trace_id, from_address, to_address, tx_hash, amount, tx_timestamp, token_symbol, token_address, transfer_type)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
        stmt.run(id, edge.traceId, edge.fromAddress, edge.toAddress, edge.txHash, edge.amount, edge.txTimestamp || null, edge.tokenSymbol || null, edge.tokenAddress || null, edge.transferType || "native");
        return { ...edge, id };
    },
};
