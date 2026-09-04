/**
 * HTTP transport for the TronGrid REST API (https://api.trongrid.io).
 *
 * TronGrid is the official Tron Foundation API — the TRX-equivalent of Etherscan.
 * Free tier (no key) allows ~15 req/sec. A free TronGrid API key bumps the limit further.
 *
 * Rate limiting: token-bucket identical to EtherscanClient so both chains consume
 * their budgets independently without head-of-line blocking each other.
 *
 * Error model:
 *   - HTTP 200 with { success: false } → classified error
 *   - HTTP 401 / 403              → AUTH
 *   - HTTP 429                    → RATE_LIMIT (exponential back-off)
 *   - HTTP 5xx / network          → UPSTREAM
 *   - Unexpected shape            → PARSE_ERROR
 */

import axios, { AxiosInstance } from "axios";
import { config } from "../config.js";

export type TronGridErrorKind = "AUTH" | "RATE_LIMIT" | "UPSTREAM" | "NOT_FOUND" | "PARSE_ERROR";

export class TronGridApiError extends Error {
  constructor(
    public readonly kind: TronGridErrorKind,
    message: string
  ) {
    super(message);
    this.name = "TronGridApiError";
  }
}

interface TokenBucket {
  tokens: number;
  lastRefill: number;
}

export class TronGridClient {
  private readonly http: AxiosInstance;
  private readonly rateLimit: number;
  private readonly maxRetries: number;
  private bucket: TokenBucket;

  constructor() {
    this.rateLimit = config.tronGrid.rateLimitPerSec;
    this.maxRetries = config.tronGrid.maxRetries;
    this.bucket = { tokens: this.rateLimit, lastRefill: Date.now() };

    this.http = axios.create({
      baseURL: config.tronGrid.baseUrl,
      timeout: config.tronGrid.timeoutMs,
      headers: config.tronGrid.apiKey
        ? { "TRON-PRO-API-KEY": config.tronGrid.apiKey }
        : {},
    });
  }

  /**
   * GET {path}?{params} — returns the parsed JSON body.
   * Automatically rate-limits and retries on 429.
   */
  async get<T>(path: string, params: Record<string, string | number | boolean> = {}): Promise<T> {
    await this.acquireToken();

    let attempt = 0;
    let backoffMs = 800;

    while (true) {
      try {
        const response = await this.http.get<T>(path, { params });
        return response.data;
      } catch (error: unknown) {
        if (!axios.isAxiosError(error)) throw error;

        const status = error.response?.status;

        if (status === 401 || status === 403) {
          throw new TronGridApiError("AUTH", `TronGrid authentication failed (HTTP ${status})`);
        }

        if (status === 404) {
          throw new TronGridApiError("NOT_FOUND", `TronGrid: resource not found — ${path}`);
        }

        if (status === 429) {
          attempt++;
          if (attempt > this.maxRetries) {
            throw new TronGridApiError("RATE_LIMIT", "TronGrid rate limit exceeded after retries");
          }
          await sleep(backoffMs);
          backoffMs = Math.min(backoffMs * 2, 10_000);
          await this.acquireToken();
          continue;
        }

        if (!status || status >= 500) {
          attempt++;
          if (attempt > this.maxRetries) {
            throw new TronGridApiError(
              "UPSTREAM",
              `TronGrid upstream error: ${error.message}`
            );
          }
          await sleep(backoffMs);
          backoffMs = Math.min(backoffMs * 2, 10_000);
          await this.acquireToken();
          continue;
        }

        throw new TronGridApiError("UPSTREAM", `TronGrid request failed: ${error.message}`);
      }
    }
  }

  private async acquireToken(): Promise<void> {
    const now = Date.now();
    const elapsed = (now - this.bucket.lastRefill) / 1000;
    this.bucket.tokens = Math.min(
      this.rateLimit,
      this.bucket.tokens + elapsed * this.rateLimit
    );
    this.bucket.lastRefill = now;

    if (this.bucket.tokens < 1) {
      const waitMs = Math.ceil(((1 - this.bucket.tokens) / this.rateLimit) * 1000);
      await sleep(waitMs);
      this.bucket.tokens = 0;
    } else {
      this.bucket.tokens -= 1;
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Singleton shared by TronChainClient and any future Tron-side services. */
export const tronGridClient = new TronGridClient();
