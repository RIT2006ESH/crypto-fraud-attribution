import { db } from "../database.js";
export class LabelRepository {
    findByAddressIgnoreCaseAndChain(address, chain) {
        const stmt = db.prepare(`
      SELECT id, address, chain, label_type as labelType, entity_name as entityName, source, confidence
      FROM address_labels
      WHERE LOWER(address) = LOWER(?) AND chain = ?
    `);
        return stmt.get(address, chain);
    }
    save(label) {
        const id = label.id || crypto.randomUUID();
        const stmt = db.prepare(`
      INSERT INTO address_labels (id, address, chain, label_type, entity_name, source, confidence)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(address, chain) DO UPDATE SET
        label_type = excluded.label_type,
        entity_name = excluded.entity_name,
        source = excluded.source,
        confidence = excluded.confidence
    `);
        stmt.run(id, label.address, label.chain, label.labelType, label.entityName || null, label.source || null, label.confidence || null);
        return { ...label, id };
    }
}
export const labelRepository = new LabelRepository();
