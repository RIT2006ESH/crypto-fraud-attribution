import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { config } from "../config.js";
import {
  AddressLabel,
  GraphEdge,
  GraphNode,
  TraceRequest,
  TraceStatus,
  LabelType,
} from "../types/index.js";
import { Case, AuditEvent } from "../types/case.js";

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

    CREATE TABLE IF NOT EXISTS cases (
      id TEXT PRIMARY KEY,
      case_reference TEXT UNIQUE NOT NULL,
      title TEXT,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      target_address TEXT,
      target_chain TEXT,
      risk_level TEXT,
      risk_score INTEGER
    );

    CREATE TABLE IF NOT EXISTS audit_events (
      id TEXT PRIMARY KEY,
      case_id TEXT,
      investigation_id TEXT,
      event_type TEXT NOT NULL,
      event_time TEXT NOT NULL,
      actor_type TEXT NOT NULL,
      metadata_json TEXT
    );
    CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY,
      investigation_id TEXT NOT NULL,
      case_id TEXT,
      version INTEGER NOT NULL,
      status TEXT NOT NULL,
      generated_at TEXT NOT NULL,
      generated_by TEXT,
      file_path TEXT,
      file_size INTEGER,
      page_count INTEGER,
      sha256_hash TEXT,
      report_data_json TEXT,
      created_at TEXT NOT NULL
    );
  `);

  migrate();
}

/** Additive migrations for databases created before a column existed. */
function migrate() {
  const labelColumns = db.prepare("PRAGMA table_info(address_labels)").all() as Array<{ name: string }>;
  if (!labelColumns.some((c) => c.name === "updated_at")) {
    db.exec("ALTER TABLE address_labels ADD COLUMN updated_at TEXT");
    console.log("[database] migrated address_labels: added updated_at");
  }

  const edgeColumns = db.prepare("PRAGMA table_info(graph_edges)").all() as Array<{ name: string }>;
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
  }
  const reportColumns = db.prepare("PRAGMA table_info(reports)").all() as Array<{ name: string }>;
  if (reportColumns.length === 0) {
     db.exec(`
    CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY,
      investigation_id TEXT NOT NULL,
      case_id TEXT,
      version INTEGER NOT NULL,
      status TEXT NOT NULL,
      generated_at TEXT NOT NULL,
      generated_by TEXT,
      file_path TEXT,
      file_size INTEGER,
      page_count INTEGER,
      sha256_hash TEXT,
      report_data_json TEXT,
      created_at TEXT NOT NULL
    );`);
    console.log("[database] migrated reports: added reports table");
  }
}

// Repositories

export const caseRepository = {
  findById(id: string): Case | undefined {
    const stmt = db.prepare("SELECT id, case_reference as caseReference, title, status, created_at as createdAt, updated_at as updatedAt, target_address as targetAddress, target_chain as targetChain, risk_level as riskLevel, risk_score as riskScore FROM cases WHERE id = ?");
    return stmt.get(id) as Case | undefined;
  },
  findByReference(ref: string): Case | undefined {
    const stmt = db.prepare("SELECT id, case_reference as caseReference, title, status, created_at as createdAt, updated_at as updatedAt, target_address as targetAddress, target_chain as targetChain, risk_level as riskLevel, risk_score as riskScore FROM cases WHERE case_reference = ?");
    return stmt.get(ref) as Case | undefined;
  },
  findAll(): Case[] {
    const stmt = db.prepare("SELECT id, case_reference as caseReference, title, status, created_at as createdAt, updated_at as updatedAt, target_address as targetAddress, target_chain as targetChain, risk_level as riskLevel, risk_score as riskScore FROM cases ORDER BY created_at DESC");
    return stmt.all() as Case[];
  },
  save(c: Partial<Case> & { caseReference: string; status: "OPEN" | "CLOSED" }): Case {
    const id = c.id || crypto.randomUUID();
    const now = new Date().toISOString();
    const createdAt = c.createdAt || now;
    const updatedAt = now;
    
    if (c.id && this.findById(c.id)) {
      db.prepare(`UPDATE cases SET case_reference=?, title=?, status=?, updated_at=?, target_address=?, target_chain=?, risk_level=?, risk_score=? WHERE id=?`).run(
        c.caseReference, c.title ?? null, c.status, updatedAt, c.targetAddress ?? null, c.targetChain ?? null, c.riskLevel ?? null, c.riskScore ?? null, id
      );
    } else {
      db.prepare(`INSERT INTO cases (id, case_reference, title, status, created_at, updated_at, target_address, target_chain, risk_level, risk_score) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
        id, c.caseReference, c.title ?? null, c.status, createdAt, updatedAt, c.targetAddress ?? null, c.targetChain ?? null, c.riskLevel ?? null, c.riskScore ?? null
      );
    }
    return this.findById(id)!;
  }
};

export const auditRepository = {
  save(event: Partial<AuditEvent> & { eventType: string, actorType: string }): AuditEvent {
    const id = event.id || crypto.randomUUID();
    const eventTime = event.eventTime || new Date().toISOString();
    db.prepare(`INSERT INTO audit_events (id, case_id, investigation_id, event_type, event_time, actor_type, metadata_json) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
      id, event.caseId ?? null, event.investigationId ?? null, event.eventType, eventTime, event.actorType, event.metadataJson ?? null
    );
    return { ...event, id, eventTime } as AuditEvent;
  },
  findByCase(caseId: string): AuditEvent[] {
    return db.prepare("SELECT id, case_id as caseId, investigation_id as investigationId, event_type as eventType, event_time as eventTime, actor_type as actorType, metadata_json as metadataJson FROM audit_events WHERE case_id = ? ORDER BY event_time DESC").all(caseId) as AuditEvent[];
  }
};

export const addressLabelRepository = {
  findByAddressIgnoreCaseAndChain(address: string, chain: string): AddressLabel | undefined {
    const stmt = db.prepare(
      "SELECT id, address, chain, label_type as labelType, entity_name as entityName, source, confidence, updated_at as updatedAt FROM address_labels WHERE LOWER(address) = LOWER(?) AND chain = ?"
    );
    return stmt.get(address, chain) as AddressLabel | undefined;
  },

  /**
   * Cache read that respects a TTL. Returns undefined when the row is missing or stale,
   * which is the signal for LabelService to go back out to Etherscan.
   */
  findFresh(address: string, chain: string, ttlHours: number): AddressLabel | undefined {
    const row = this.findByAddressIgnoreCaseAndChain(address, chain);
    if (!row) return undefined;
    if (ttlHours <= 0) return row;
    if (!row.updatedAt) return undefined;

    const ageMs = Date.now() - new Date(row.updatedAt).getTime();
    if (!Number.isFinite(ageMs) || ageMs > ttlHours * 3_600_000) return undefined;
    return row;
  },

  save(label: Omit<AddressLabel, "id"> & { id?: string }): AddressLabel {
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
    stmt.run(
      id,
      label.address,
      label.chain,
      label.labelType,
      label.entityName ?? null,
      label.source ?? null,
      label.confidence ?? null,
      updatedAt
    );
    return { ...label, id, updatedAt };
  },
};

export const traceRequestRepository = {
  findById(id: string): TraceRequest | undefined {
    const stmt = db.prepare(`
      SELECT id, case_id as caseId, wallet_address as walletAddress, chain, status,
             hops_traced as hopsTraced, risk_score as riskScore, flagged_patterns as flaggedPatterns,
             requested_at as requestedAt, completed_at as completedAt, failure_reason as failureReason
      FROM trace_requests WHERE id = ?
    `);
    return stmt.get(id) as TraceRequest | undefined;
  },

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
  },

  findAll(limit = 50, offset = 0): TraceRequest[] {
    const stmt = db.prepare(`
      SELECT id, case_id as caseId, wallet_address as walletAddress, chain, status,
             hops_traced as hopsTraced, risk_score as riskScore, flagged_patterns as flaggedPatterns,
             requested_at as requestedAt, completed_at as completedAt, failure_reason as failureReason
      FROM trace_requests
      ORDER BY requested_at DESC
      LIMIT ? OFFSET ?
    `);
    return stmt.all(limit, offset) as TraceRequest[];
  },

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
  },
};

export const graphNodeRepository = {
  findByTraceId(traceId: string): GraphNode[] {
    const stmt = db.prepare(`
      SELECT id, trace_id as traceId, address, hop_depth as hopDepth, label_type as labelType, label_confidence as labelConfidence, partial_data as partialData
      FROM graph_nodes WHERE trace_id = ?
    `);
    const rows = stmt.all(traceId) as any[];
    return rows.map((r) => ({
      ...r,
      partialData: Boolean(r.partialData),
    }));
  },

  /**
   * ML label upgrade: an UNLABELED node the model flags (e.g. behavioural mixer)
   * is re-labelled in place so counts, filters, ledger and risk all follow.
   * Never touches curated labels — callers must check UNLABELED first.
   */
  updateLabel(traceId: string, address: string, labelType: LabelType, confidence: number | null): void {
    db.prepare(`
      UPDATE graph_nodes SET label_type = ?, label_confidence = ?
      WHERE trace_id = ? AND LOWER(address) = LOWER(?)
    `).run(labelType, confidence, traceId, address);
  },

  save(node: Omit<GraphNode, "id"> & { id?: string }): GraphNode {
    const id = node.id || crypto.randomUUID();
    const stmt = db.prepare(`
      INSERT INTO graph_nodes (id, trace_id, address, hop_depth, label_type, label_confidence, partial_data)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      id,
      node.traceId,
      node.address,
      node.hopDepth,
      node.labelType || null,
      node.labelConfidence ?? null,
      node.partialData ? 1 : 0
    );
    return { ...node, id };
  },
};

export const graphEdgeRepository = {
  findByTraceId(traceId: string): GraphEdge[] {
    const stmt = db.prepare(`
      SELECT id, trace_id as traceId, from_address as fromAddress, to_address as toAddress,
             tx_hash as txHash, amount, tx_timestamp as txTimestamp,
             token_symbol as tokenSymbol, token_address as tokenAddress, transfer_type as transferType
      FROM graph_edges WHERE trace_id = ?
    `);
    return stmt.all(traceId) as GraphEdge[];
  },

  save(edge: Omit<GraphEdge, "id"> & { id?: string }): GraphEdge {
    const id = edge.id || crypto.randomUUID();
    const stmt = db.prepare(`
      INSERT INTO graph_edges (id, trace_id, from_address, to_address, tx_hash, amount, tx_timestamp, token_symbol, token_address, transfer_type)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      id,
      edge.traceId,
      edge.fromAddress,
      edge.toAddress,
      edge.txHash,
      edge.amount,
      edge.txTimestamp || null,
      edge.tokenSymbol || null,
      edge.tokenAddress || null,
      edge.transferType || "native"
    );
    return { ...edge, id };
  },
};

export const reportRepository = {
  findById(id: string): any | undefined {
    const stmt = db.prepare(`
      SELECT id, investigation_id as investigationId, case_id as caseId, version as reportVersion, status,
             generated_at as generatedAt, generated_by as generatedBy, file_path as reportPath,
             file_size as fileSize, page_count as pageCount, sha256_hash as reportHash, report_data_json as reportDataJson
      FROM reports WHERE id = ?
    `);
    return stmt.get(id);
  },
  
  findByInvestigationId(investigationId: string): any[] {
     const stmt = db.prepare(`
      SELECT id, investigation_id as investigationId, case_id as caseId, version as reportVersion, status,
             generated_at as generatedAt, generated_by as generatedBy, file_path as reportPath,
             file_size as fileSize, page_count as pageCount, sha256_hash as reportHash, report_data_json as reportDataJson
      FROM reports WHERE investigation_id = ? ORDER BY version DESC
    `);
    return stmt.all(investigationId) as any[];
  },

  save(req: any): any {
    const id = req.id || crypto.randomUUID();
    const existing = req.id ? this.findById(req.id) : undefined;
    const createdAt = new Date().toISOString();

    if (existing) {
      const stmt = db.prepare(`
        UPDATE reports
        SET status = ?, file_path = ?, file_size = ?, page_count = ?, sha256_hash = ?, report_data_json = ?
        WHERE id = ?
      `);
      stmt.run(
        req.status,
        req.reportPath || null,
        req.fileSize || null,
        req.pageCount || null,
        req.reportHash || null,
        req.reportDataJson || null,
        id
      );
    } else {
      const stmt = db.prepare(`
        INSERT INTO reports (id, investigation_id, case_id, version, status, generated_at, generated_by, file_path, file_size, page_count, sha256_hash, report_data_json, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run(
        id,
        req.investigationId,
        req.caseId || null,
        req.reportVersion,
        req.status,
        req.generatedAt,
        req.generatedBy || null,
        req.reportPath || null,
        req.fileSize || null,
        req.pageCount || null,
        req.reportHash || null,
        req.reportDataJson || null,
        createdAt
      );
    }
    return this.findById(id)!;
  }
};
