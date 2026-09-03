import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { config } from "../config/index.js";
const dbDir = path.dirname(config.dbPath);
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}
export const db = new Database(config.dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
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
      partial_data INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY(trace_id) REFERENCES trace_requests(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS graph_edges (
      id TEXT PRIMARY KEY,
      trace_id TEXT NOT NULL,
      from_address TEXT NOT NULL,
      to_address TEXT NOT NULL,
      tx_hash TEXT NOT NULL,
      amount TEXT,
      tx_timestamp TEXT,
      FOREIGN KEY(trace_id) REFERENCES trace_requests(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS graph_cache (
      trace_id TEXT PRIMARY KEY,
      graph_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY(trace_id) REFERENCES trace_requests(id) ON DELETE CASCADE
    );
  `);
}
