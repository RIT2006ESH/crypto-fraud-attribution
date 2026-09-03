import { db } from "../database.js";
export class GraphRepository {
    findNodesByTraceId(traceId) {
        const stmt = db.prepare(`
      SELECT id, trace_id as traceId, address, hop_depth as hopDepth, label_type as labelType, label_confidence as labelConfidence, partial_data as partialData
      FROM graph_nodes WHERE trace_id = ?
    `);
        const rows = stmt.all(traceId);
        return rows.map((r) => ({
            ...r,
            partialData: Boolean(r.partialData),
        }));
    }
    saveNode(node) {
        const id = node.id || crypto.randomUUID();
        const stmt = db.prepare(`
      INSERT INTO graph_nodes (id, trace_id, address, hop_depth, label_type, label_confidence, partial_data)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
        stmt.run(id, node.traceId, node.address, node.hopDepth, node.labelType || null, node.labelConfidence ?? null, node.partialData ? 1 : 0);
        return { ...node, id };
    }
    findEdgesByTraceId(traceId) {
        const stmt = db.prepare(`
      SELECT id, trace_id as traceId, from_address as fromAddress, to_address as toAddress, tx_hash as txHash, amount, tx_timestamp as txTimestamp
      FROM graph_edges WHERE trace_id = ?
    `);
        return stmt.all(traceId);
    }
    saveEdge(edge) {
        const id = edge.id || crypto.randomUUID();
        const stmt = db.prepare(`
      INSERT INTO graph_edges (id, trace_id, from_address, to_address, tx_hash, amount, tx_timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
        stmt.run(id, edge.traceId, edge.fromAddress, edge.toAddress, edge.txHash, edge.amount, edge.txTimestamp || null);
        return { ...edge, id };
    }
    findCacheByTraceId(traceId) {
        const stmt = db.prepare(`
      SELECT trace_id as traceId, graph_json as graphJson, created_at as createdAt
      FROM graph_cache WHERE trace_id = ?
    `);
        return stmt.get(traceId);
    }
    saveCache(traceId, graphJson) {
        const createdAt = new Date().toISOString();
        const stmt = db.prepare(`
      INSERT INTO graph_cache (trace_id, graph_json, created_at)
      VALUES (?, ?, ?)
      ON CONFLICT(trace_id) DO UPDATE SET
        graph_json = excluded.graph_json,
        created_at = excluded.created_at
    `);
        stmt.run(traceId, graphJson, createdAt);
        return { traceId, graphJson, createdAt };
    }
}
export const graphRepository = new GraphRepository();
