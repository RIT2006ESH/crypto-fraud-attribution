import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
// Resolve the backend root from this module's own location so the server picks up
// backend/.env no matter which directory it was launched from (src/ in dev via tsx,
// dist/ in production — both are one level below the backend root).
const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(backendRoot, ".env") });
function int(value, fallback) {
    const parsed = parseInt(value ?? "", 10);
    return Number.isFinite(parsed) ? parsed : fallback;
}
function bool(value, fallback) {
    if (value === undefined || value.trim() === "")
        return fallback;
    return value.trim().toLowerCase() === "true";
}
const apiKey = (process.env.ETHERSCAN_API_KEY || "").trim();
export const config = {
    backendRoot,
    port: int(process.env.PORT, 8080),
    etherscan: {
        baseUrl: process.env.ETHERSCAN_BASE_URL || "https://api.etherscan.io/v2/api",
        apiKey,
        chainId: int(process.env.ETHERSCAN_CHAIN_ID, 1),
        // Free tier allows 5 calls/sec. Stay under it: the tracer issues one call per hop.
        rateLimitPerSec: int(process.env.ETHERSCAN_RATE_LIMIT_PER_SEC, 4),
        maxRetries: int(process.env.ETHERSCAN_MAX_RETRIES, 3),
        txPageSize: int(process.env.ETHERSCAN_TX_PAGE_SIZE, 1000),
        // One page per hop keeps a trace to one Etherscan call per address. Raise it to widen
        // the window on long-lived wallets at the cost of latency.
        txMaxPages: int(process.env.ETHERSCAN_TX_MAX_PAGES, 1),
        // "desc" = newest first, which is the relevant window when tracing where funds went
        // now. "asc" reproduces the original oldest-first behaviour.
        txSort: (process.env.ETHERSCAN_TX_SORT || "desc").toLowerCase() === "asc" ? "asc" : "desc",
        timeoutMs: int(process.env.ETHERSCAN_TIMEOUT_MS, 20000),
    },
    tronGrid: {
        baseUrl: (process.env.TRONGRID_BASE_URL || "https://api.trongrid.io").replace(/\/$/, ""),
        // Optional: a TronGrid API key unlocks higher rate limits (https://www.trongrid.io/)
        apiKey: (process.env.TRONGRID_API_KEY || "").trim(),
        // Free tier (no key) allows ~15 req/sec. Be conservative to avoid 429s.
        rateLimitPerSec: int(process.env.TRONGRID_RATE_LIMIT_PER_SEC, 10),
        maxRetries: int(process.env.TRONGRID_MAX_RETRIES, 3),
        // How many transactions to fetch per address per page call.
        txLimit: int(process.env.TRONGRID_TX_LIMIT, 200),
        timeoutMs: int(process.env.TRONGRID_TIMEOUT_MS, 20000),
    },
    trace: {
        maxHops: int(process.env.TRACE_MAX_HOPS, 4),
        maxFanOut: int(process.env.TRACE_MAX_FANOUT, 10),
        maxNodes: int(process.env.TRACE_MAX_NODES, 60),
        preferCached: bool(process.env.TRACE_PREFER_CACHED, false),
    },
    labels: {
        // Derive labels from on-chain/contract metadata when the curated registry misses.
        enrichFromChain: bool(process.env.LABELS_ENRICH_FROM_CHAIN, true),
        cacheTtlHours: int(process.env.LABELS_CACHE_TTL_HOURS, 168),
    },
    graphql: {
        path: process.env.GRAPHQL_PATH || "/graphql",
        graphiql: bool(process.env.GRAPHQL_GRAPHIQL, true),
    },
    dbPath: process.env.DB_PATH
        ? path.resolve(backendRoot, process.env.DB_PATH)
        : path.join(backendRoot, "data", "cryptofraud.sqlite"),
    /**
     * Static registry of chains the system supports, returned verbatim by GET /api/chains.
     * "all" is a meta-entry that triggers a parallel scan across all real chains.
     */
    supportedChains: [
        {
            id: "ethereum",
            name: "Ethereum",
            nativeSymbol: "ETH",
            tokens: ["USDT", "USDC", "WETH", "DAI"],
        },
        {
            id: "tron",
            name: "Tron",
            nativeSymbol: "TRX",
            tokens: ["USDT", "USDC"],
        },
        {
            id: "all",
            name: "All Chains",
            nativeSymbol: "",
            tokens: [],
            multi: true,
        },
    ],
};
/** Fail loudly at boot instead of silently returning empty traces on every request. */
export function assertConfig() {
    if (!config.etherscan.apiKey) {
        console.error("[config] ETHERSCAN_API_KEY is not set. Copy backend/.env.example to backend/.env and add your key —\n" +
            "         without it every Etherscan call returns 'Missing/Invalid API Key' and traces come back empty.");
    }
    if (config.etherscan.apiKey === "YourApiKeyToken") {
        console.error("[config] ETHERSCAN_API_KEY is still the placeholder value; Etherscan will reject every call.");
    }
}
