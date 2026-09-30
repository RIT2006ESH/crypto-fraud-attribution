import axios from "axios";
import { config } from "../config.js";
export class EtherscanApiError extends Error {
    kind;
    action;
    constructor(kind, action, message) {
        super(message);
        this.name = "EtherscanApiError";
        this.kind = kind;
        this.action = action;
    }
}
const NO_RECORD_MESSAGES = ["no transactions found", "no records found", "no data found"];
function classify(action, message, resultText) {
    const haystack = `${message} ${resultText}`.toLowerCase();
    if (haystack.includes("invalid api key") || haystack.includes("missing/invalid api key")) {
        return new EtherscanApiError("AUTH", action, "Etherscan rejected the API key. Set ETHERSCAN_API_KEY in backend/.env to a valid key from https://etherscan.io/myapikey");
    }
    if (haystack.includes("api exclusive") || haystack.includes("upgrade your api plan")) {
        return new EtherscanApiError("PRO_REQUIRED", action, `Etherscan '${action}' requires a paid plan on this API key.`);
    }
    if (haystack.includes("rate limit") || haystack.includes("too many")) {
        return new EtherscanApiError("RATE_LIMIT", action, `Etherscan rate limit hit on '${action}'.`);
    }
    return new EtherscanApiError("UPSTREAM", action, `Etherscan '${action}' failed: ${resultText || message}`);
}
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
/**
 * Shared Etherscan API V2 transport.
 *
 * Etherscan answers HTTP 200 for logical failures, so every caller has to read the
 * envelope. Doing that in one place means a bad key or a throttle surfaces as a thrown
 * EtherscanApiError instead of an empty array that looks like "this wallet never sent
 * anything" — the exact failure that made traces come back blank.
 */
export class EtherscanClient {
    http;
    minIntervalMs;
    nextSlot = 0;
    /** Endpoints this key is not entitled to; skipped after the first rejection. */
    gatedActions = new Set();
    constructor() {
        this.http = axios.create({
            baseURL: config.etherscan.baseUrl,
            timeout: config.etherscan.timeoutMs,
            // Inspect non-2xx ourselves so retry/classification logic stays in one place.
            validateStatus: () => true,
        });
        const perSec = Math.max(1, config.etherscan.rateLimitPerSec);
        this.minIntervalMs = Math.ceil(1000 / perSec);
    }
    isGated(action) {
        return this.gatedActions.has(action);
    }
    /** Spaces out call starts so bursts stay under the account's calls/sec ceiling. */
    async throttle() {
        const now = Date.now();
        const slot = Math.max(now, this.nextSlot);
        this.nextSlot = slot + this.minIntervalMs;
        if (slot > now) {
            await sleep(slot - now);
        }
    }
    /**
     * Issue one Etherscan call.
     * @returns the `result` payload, or `null` when the query was valid but matched nothing.
     * @throws EtherscanApiError for auth, plan, and upstream failures.
     */
    async call(params) {
        const action = String(params.action ?? params.module ?? "unknown");
        if (this.gatedActions.has(action)) {
            throw new EtherscanApiError("PRO_REQUIRED", action, `Etherscan '${action}' is not available on this plan.`);
        }
        const query = {
            chainid: params.chainid ?? config.etherscan.chainId,
            ...params,
            apikey: config.etherscan.apiKey,
        };
        let lastError = null;
        for (let attempt = 0; attempt <= config.etherscan.maxRetries; attempt++) {
            await this.throttle();
            try {
                const response = await this.http.get("", { params: query });
                if (response.status >= 500) {
                    lastError = new EtherscanApiError("UPSTREAM", action, `Etherscan returned HTTP ${response.status}.`);
                }
                else if (response.status === 429) {
                    lastError = new EtherscanApiError("RATE_LIMIT", action, `Etherscan returned HTTP 429 on '${action}'.`);
                }
                else if (response.status >= 400) {
                    throw new EtherscanApiError("BAD_REQUEST", action, `Etherscan returned HTTP ${response.status}.`);
                }
                else {
                    const body = response.data;
                    if (body && typeof body === "object" && "jsonrpc" in body) {
                        if (body.error) {
                            throw new EtherscanApiError("BAD_REQUEST", action, body.error.message || "JSON-RPC error");
                        }
                        return (body.result ?? null);
                    }
                    const status = String(body?.status ?? "");
                    const message = String(body?.message ?? "");
                    const resultText = typeof body?.result === "string" ? body.result : "";
                    if (status === "1") {
                        return (body?.result ?? null);
                    }
                    // status "0" is overloaded: empty result set OR an error, told apart by message.
                    if (NO_RECORD_MESSAGES.some((m) => message.toLowerCase().includes(m))) {
                        return null;
                    }
                    if (status === "0" && Array.isArray(body?.result) && body.result.length === 0) {
                        return null;
                    }
                    const classified = classify(action, message, resultText);
                    if (classified.kind === "RATE_LIMIT") {
                        lastError = classified;
                    }
                    else {
                        if (classified.kind === "PRO_REQUIRED") {
                            this.gatedActions.add(action);
                        }
                        throw classified;
                    }
                }
            }
            catch (error) {
                if (error instanceof EtherscanApiError) {
                    if (error.kind !== "RATE_LIMIT")
                        throw error;
                    lastError = error;
                }
                else {
                    const msg = error instanceof Error ? error.message : String(error);
                    lastError = new EtherscanApiError("UPSTREAM", action, `Etherscan request failed: ${msg}`);
                }
            }
            if (attempt < config.etherscan.maxRetries) {
                // Exponential backoff: 600ms, 1.2s, 2.4s ...
                await sleep(600 * 2 ** attempt);
            }
        }
        throw lastError ?? new EtherscanApiError("UPSTREAM", action, `Etherscan '${action}' failed.`);
    }
}
export const etherscanClient = new EtherscanClient();
