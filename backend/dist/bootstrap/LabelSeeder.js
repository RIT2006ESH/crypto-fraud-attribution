import fs from "fs";
import { config } from "../config/index.js";
import { labelRepository } from "../db/repositories/index.js";
import { LabelType } from "../types/index.js";
export function seedLabels() {
    if (!config.labels.seedOnStartup) {
        console.log("[LabelSeeder] Label seeding disabled by config.");
        return;
    }
    const csvPath = config.labels.csvPath;
    if (!fs.existsSync(csvPath)) {
        console.warn(`[LabelSeeder] ${csvPath} not found; every address will trace as UNLABELED`);
        return;
    }
    let added = 0;
    let skipped = 0;
    let malformed = 0;
    try {
        const content = fs.readFileSync(csvPath, "utf-8");
        const lines = content.split(/\r?\n/);
        let header = true;
        for (let rawLine of lines) {
            const line = rawLine.trim();
            if (!line || line.startsWith("#"))
                continue;
            if (header) {
                header = false;
                continue;
            }
            const cols = line.split(",").map((c) => c.trim());
            if (cols.length < 4) {
                malformed++;
                continue;
            }
            const address = cols[0];
            const chain = cols[1].toLowerCase();
            const rawType = cols[2].toUpperCase();
            const entityName = cols[3];
            const source = cols.length > 4 ? cols[4] : "seed";
            const confidence = cols.length > 5 && cols[5] ? parseFloat(cols[5]) : 0.9;
            if (!Object.values(LabelType).includes(rawType)) {
                malformed++;
                continue;
            }
            const existing = labelRepository.findByAddressIgnoreCaseAndChain(address, chain);
            if (existing) {
                skipped++;
                continue;
            }
            labelRepository.save({
                address,
                chain,
                labelType: rawType,
                entityName,
                source,
                confidence,
            });
            added++;
        }
        console.log(`[LabelSeeder] Labels seeded: ${added} added, ${skipped} already present, ${malformed} malformed`);
    }
    catch (error) {
        console.error(`[LabelSeeder] Label seeding aborted: ${error.message}`);
    }
}
