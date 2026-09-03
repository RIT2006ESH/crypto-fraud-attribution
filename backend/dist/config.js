import dotenv from "dotenv";
import path from "path";
dotenv.config();
export const config = {
    port: parseInt(process.env.PORT || "8080", 10),
    etherscan: {
        baseUrl: process.env.ETHERSCAN_BASE_URL || "https://api.etherscan.io/v2/api",
        apiKey: process.env.ETHERSCAN_API_KEY || "YourApiKeyToken",
    },
    trace: {
        maxHops: parseInt(process.env.TRACE_MAX_HOPS || "5", 10),
        maxFanOut: parseInt(process.env.TRACE_MAX_FANOUT || "20", 10),
        maxNodes: parseInt(process.env.TRACE_MAX_NODES || "200", 10),
        preferCached: process.env.TRACE_PREFER_CACHED === "true",
    },
    labels: {
        seedOnStartup: process.env.LABELS_SEED_ON_STARTUP !== "false",
        csvPath: process.env.LABELS_CSV_PATH || path.join(process.cwd(), "seed-labels.csv"),
    },
    dbPath: process.env.DB_PATH || path.join(process.cwd(), "data", "cryptofraud.sqlite"),
};
