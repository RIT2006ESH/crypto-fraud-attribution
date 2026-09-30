/**
 * Tron chain client — fetches outgoing TRX (native) and TRC-20 token transfers for an address.
 *
 * API: TronGrid REST v1 (https://api.trongrid.io/v1/accounts/{address}/...)
 *
 * Two calls per address:
 *   1. /v1/accounts/{addr}/transactions   — native TRX TransferContract only
 *   2. /v1/accounts/{addr}/transactions/trc20 — all TRC-20 token transfers
 *
 * TRX amounts: the chain stores values in "sun" (1 TRX = 1,000,000 sun). Converted using BigInt
 * to avoid float precision loss, identical to the wei→ETH conversion on the Ethereum side.
 *
 * TRC-20 amounts: stored as raw integer strings with per-token decimal places.
 * USDT on Tron = 6 decimals, USDC on Tron = 6 decimals.
 *
 * Addresses: Tron uses base58check (T…). The TronGrid API accepts and returns base58 addresses.
 */

import { config } from "../config.js";
import { TronGridApiError, tronGridClient } from "./TronGridClient.js";
import { ChainTransaction } from "../types/index.js";
import type { ChainClient } from "./EvmChainClient.js";

const SUN_PER_TRX = 1_000_000n;

/** Convert sun (smallest TRX unit) to an exact decimal TRX string. */
function sunToTrx(sun: bigint): string {
  const whole = sun / SUN_PER_TRX;
  const frac = (sun % SUN_PER_TRX).toString().padStart(6, "0").replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : whole.toString();
}

/** Convert raw token integer to decimal string using the token's decimal places. */
function rawToDecimal(raw: bigint, decimals: number): string {
  if (decimals === 0) return raw.toString();
  const divisor = 10n ** BigInt(decimals);
  const whole = raw / divisor;
  const frac = (raw % divisor).toString().padStart(decimals, "0").replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : whole.toString();
}

// ── TronGrid response shapes ──────────────────────────────────────────────────

interface TronGridPage<T> {
  data: T[];
  success: boolean;
  meta?: {
    at?: number;
    fingerprint?: string;
    links?: { next?: string };
    page_size?: number;
  };
}

/** Native TRX transaction as returned by /v1/accounts/{addr}/transactions */
interface TronGridTx {
  txID?: string;
  block_timestamp?: number;
  ret?: Array<{ contractRet?: string; fee?: number }>;
  raw_data?: {
    contract?: Array<{
      type?: string;
      parameter?: {
        value?: {
          to_address?: string;
          owner_address?: string;
          amount?: number;
        };
      };
    }>;
  };
}

/** TRC-20 transfer as returned by /v1/accounts/{addr}/transactions/trc20 */
interface TronGridTrc20Transfer {
  transaction_id?: string;
  block_timestamp?: number;
  from?: string;
  to?: string;
  value?: string;
  token_info?: {
    symbol?: string;
    address?: string;
    decimals?: number;
    name?: string;
  };
  type?: string;
}

// ─────────────────────────────────────────────────────────────────────────────

export class TronChainClient implements ChainClient {
  chain(): string {
    return "tron";
  }

  /**
   * Returns all outgoing transfers (native TRX + TRC-20 tokens) for an address,
   * sorted by raw amount descending so the largest flows appear first — consistent
   * with the Ethereum client's ordering.
   */
  async getOutgoingTransactions(address: string): Promise<ChainTransaction[]> {
    const [trxTxs, trc20Txs] = await Promise.allSettled([
      this.fetchNativeTrx(address),
      this.fetchTrc20(address),
    ]);

    const results: ChainTransaction[] = [];

    if (trxTxs.status === "fulfilled") {
      results.push(...trxTxs.value);
    } else {
      const err = trxTxs.reason;
      // AUTH errors are fatal — surface them so TraceService can fail gracefully.
      if (err instanceof TronGridApiError && err.kind === "AUTH") throw err;
      console.warn(`[TronChainClient] native TRX fetch failed for ${address}: ${err?.message ?? err}`);
    }

    if (trc20Txs.status === "fulfilled") {
      results.push(...trc20Txs.value);
    } else {
      const err = trc20Txs.reason;
      if (err instanceof TronGridApiError && err.kind === "AUTH") throw err;
      console.warn(`[TronChainClient] TRC-20 fetch failed for ${address}: ${err?.message ?? err}`);
    }

    // Sort by raw amount descending (largest first), consistent with Ethereum client.
    results.sort((a, b) => {
      const av = BigInt(a.amountRaw ?? "0");
      const bv = BigInt(b.amountRaw ?? "0");
      return av === bv ? 0 : bv > av ? 1 : -1;
    });

    return results;
  }

  // ── Native TRX ─────────────────────────────────────────────────────────────

  private async fetchNativeTrx(address: string): Promise<ChainTransaction[]> {
    const txns: ChainTransaction[] = [];
    const lower = address.toLowerCase();
    let fingerprint: string | undefined;
    let fetched = 0;
    const limit = config.tronGrid.txLimit;

    do {
      const params: Record<string, string | number | boolean> = {
        only_from: true,
        limit,
        order_by: "block_timestamp,desc",
      };
      if (fingerprint) params.fingerprint = fingerprint;

      const page = await tronGridClient.get<TronGridPage<TronGridTx>>(
        `/v1/accounts/${address}/transactions`,
        params
      );

      if (!page.success || !Array.isArray(page.data)) break;

      for (const tx of page.data) {
        const parsed = this.parseNativeTx(tx, lower);
        if (parsed) txns.push(parsed);
      }

      fetched += page.data.length;
      fingerprint = page.meta?.fingerprint;

      // Stop when we have enough or the page is short (last page).
      if (page.data.length < limit || fetched >= limit * 2) break;
    } while (fingerprint);

    return txns;
  }

  private parseNativeTx(tx: TronGridTx, fromLower: string): ChainTransaction | null {
    if (!tx.txID) return null;

    // Only successful txs.
    const contractRet = tx.ret?.[0]?.contractRet;
    if (contractRet && contractRet !== "SUCCESS") return null;

    const contract = tx.raw_data?.contract?.[0];
    if (contract?.type !== "TransferContract") return null;

    const value = contract?.parameter?.value;
    if (!value) return null;

    const ownerAddr = value.owner_address;
    const toAddr = value.to_address;
    if (!ownerAddr || !toAddr) return null;

    // TronGrid sometimes returns hex-encoded addresses; we want base58.
    // Both should already be base58 in the REST v1 API, but we guard anyway.
    if (ownerAddr.toLowerCase() !== fromLower.toLowerCase()) return null;

    const sunAmount = BigInt(value.amount ?? 0);
    if (sunAmount === 0n) return null;

    const timestampMs = tx.block_timestamp ?? 0;
    const timestamp = timestampMs > 0
      ? new Date(timestampMs).toISOString()
      : new Date(0).toISOString();

    return {
      txHash: tx.txID,
      fromAddress: ownerAddr,
      toAddress: toAddr,
      amount: sunToTrx(sunAmount),
      amountRaw: sunAmount.toString(),
      timestamp,
      chain: "tron",
      transferType: "native",
    };
  }

  // ── TRC-20 Tokens ───────────────────────────────────────────────────────────

  private async fetchTrc20(address: string): Promise<ChainTransaction[]> {
    const txns: ChainTransaction[] = [];
    const lower = address.toLowerCase();
    let fingerprint: string | undefined;
    let fetched = 0;
    const limit = config.tronGrid.txLimit;

    do {
      const params: Record<string, string | number | boolean> = {
        limit,
        order_by: "block_timestamp,desc",
        only_from: true,
      };
      if (fingerprint) params.fingerprint = fingerprint;

      const page = await tronGridClient.get<TronGridPage<TronGridTrc20Transfer>>(
        `/v1/accounts/${address}/transactions/trc20`,
        params
      );

      if (!page.success || !Array.isArray(page.data)) break;

      for (const transfer of page.data) {
        const parsed = this.parseTrc20Transfer(transfer, lower);
        if (parsed) txns.push(parsed);
      }

      fetched += page.data.length;
      fingerprint = page.meta?.fingerprint;

      if (page.data.length < limit || fetched >= limit * 2) break;
    } while (fingerprint);

    return txns;
  }

  private parseTrc20Transfer(transfer: TronGridTrc20Transfer, fromLower: string): ChainTransaction | null {
    if (!transfer.transaction_id) return null;
    if (!transfer.from || transfer.from.toLowerCase() !== fromLower.toLowerCase()) return null;
    if (!transfer.to) return null;

    const valueStr = transfer.value ?? "0";
    let rawAmount: bigint;
    try {
      rawAmount = BigInt(valueStr);
    } catch {
      return null;
    }
    if (rawAmount === 0n) return null;

    const decimals = transfer.token_info?.decimals ?? 6; // USDT/USDC default to 6
    const symbol = transfer.token_info?.symbol ?? "UNKNOWN";
    const tokenAddress = transfer.token_info?.address ?? "";

    const timestampMs = transfer.block_timestamp ?? 0;
    const timestamp = timestampMs > 0
      ? new Date(timestampMs).toISOString()
      : new Date(0).toISOString();

    return {
      txHash: transfer.transaction_id,
      fromAddress: transfer.from,
      toAddress: transfer.to,
      amount: rawToDecimal(rawAmount, decimals),
      amountRaw: rawAmount.toString(),
      timestamp,
      chain: "tron",
      tokenSymbol: symbol,
      tokenAddress,
      tokenDecimals: decimals,
      transferType: "trc20",
    };
  }
}
