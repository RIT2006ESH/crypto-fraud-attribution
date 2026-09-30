import { config } from "../config.js";
import { EtherscanApiError, etherscanClient } from "./EtherscanClient.js";
import { ChainTransaction } from "../types/index.js";

const WEI_PER_ETH = 10n ** 18n;
/** Etherscan caps txlist paging at 10,000 records per address. */
const MAX_TX_RECORDS = 10_000;

export interface ChainClient {
  chain(): string;
  getOutgoingTransactions(address: string): Promise<ChainTransaction[]>;
}

interface EtherscanTx {
  hash?: string;
  from?: string;
  to?: string;
  value?: string;
  timeStamp?: string;
  isError?: string;
  txreceipt_status?: string;
}

interface EtherscanTokenTx {
  hash?: string;
  from?: string;
  to?: string;
  value?: string;
  timeStamp?: string;
  isError?: string;
  tokenName?: string;
  tokenSymbol?: string;
  contractAddress?: string;
  tokenDecimal?: string;
}

/** Exact wei -> ETH decimal string; no float rounding. */
export function weiToEth(wei: bigint): string {
  const whole = wei / WEI_PER_ETH;
  const fraction = (wei % WEI_PER_ETH).toString().padStart(18, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

/** Convert raw token integer to decimal string using the token's decimal places. */
function rawToDecimal(raw: bigint, decimals: number): string {
  if (decimals === 0) return raw.toString();
  const divisor = 10n ** BigInt(decimals);
  const whole = raw / divisor;
  const frac = (raw % divisor).toString().padStart(decimals, "0").replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : whole.toString();
}

export class EvmChainClient implements ChainClient {
  constructor(private chainName: string, private chainId: number) {}

  chain(): string {
    return this.chainName;
  }

  /**
   * All outgoing value transfers for an address: native ETH + ERC-20 tokens.
   * Merged and deduplicated on (txHash + toAddress), then sorted by raw amount descending.
   *
   * The ERC-20 sweep is critical — USDT and USDC account for the majority of fraud
   * cashout flows on Ethereum; a native-ETH-only trace misses most of them.
   *
   * Throws on auth/plan failures so a misconfigured key shows up as a FAILED trace.
   */
  async getOutgoingTransactions(address: string): Promise<ChainTransaction[]> {
    // Sequential, never parallel: two in-flight requests routinely trip the free
    // tier's throttle, which Etherscan disguises as "Invalid API Key" and which
    // used to kill whole traces. Slower per hop, but traces actually finish.
    const txns: ChainTransaction[] = [];

    try {
      txns.push(...(await this.fetchNativeTransfers(address)));
    } catch (err: unknown) {
      // AUTH / PRO_REQUIRED errors must propagate to stop the trace cleanly.
      if (err instanceof EtherscanApiError && (err.kind === "AUTH" || err.kind === "PRO_REQUIRED")) {
        throw err;
      }
      console.warn(`[EvmChainClient:${this.chainName}] native fetch failed for ${address}: ${err instanceof Error ? err.message : err}`);
    }

    try {
      txns.push(...(await this.fetchTokenTransfers(address)));
    } catch (err: unknown) {
      if (err instanceof EtherscanApiError && (err.kind === "AUTH" || err.kind === "PRO_REQUIRED")) {
        throw err;
      }
      console.warn(`[EvmChainClient:${this.chainName}] ERC-20 fetch failed for ${address}: ${err instanceof Error ? err.message : err}`);
    }

    // Deduplicate: the same txHash can appear in both lists (e.g. a tx that transfers ETH
    // and emits a token transfer event). Keep both entries only when the toAddress differs.
    const seen = new Set<string>();
    const deduped: ChainTransaction[] = [];
    for (const tx of txns) {
      const key = `${tx.txHash}:${tx.toAddress.toLowerCase()}:${tx.transferType}`;
      if (!seen.has(key)) {
        seen.add(key);
        deduped.push(tx);
      }
    }

    // Sort by raw amount descending — exact BigInt comparison avoids float precision loss.
    deduped.sort((a, b) => {
      const av = BigInt(a.amountRaw ?? "0");
      const bv = BigInt(b.amountRaw ?? "0");
      return av === bv ? 0 : bv > av ? 1 : -1;
    });

    return deduped;
  }

  // ── Native ETH transfers ────────────────────────────────────────────────────

  private async fetchNativeTransfers(address: string): Promise<ChainTransaction[]> {
    const raw = await this.fetchAllPages(address, "txlist");
    const lower = address.toLowerCase();
    const txs: ChainTransaction[] = [];

    for (const tx of raw as EtherscanTx[]) {
      if (!tx.from || tx.from.toLowerCase() !== lower) continue;
      if (tx.isError === "1" || tx.txreceipt_status === "0") continue;
      if (!tx.to || tx.to.trim() === "") continue;
      if (!tx.hash) continue;

      let wei: bigint;
      try {
        wei = BigInt(tx.value || "0");
      } catch {
        continue;
      }
      if (wei === 0n) continue;

      const timestamp = parseTimestamp(tx.timeStamp);
      txs.push({
        txHash: tx.hash,
        fromAddress: tx.from,
        toAddress: tx.to,
        amount: weiToEth(wei),
        amountRaw: wei.toString(),
        timestamp,
        chain: this.chainName,
        transferType: "native",
      });
    }

    return txs;
  }

  // ── ERC-20 token transfers ──────────────────────────────────────────────────

  private async fetchTokenTransfers(address: string): Promise<ChainTransaction[]> {
    const raw = await this.fetchAllPages(address, "tokentx");
    const lower = address.toLowerCase();
    const txs: ChainTransaction[] = [];

    for (const tx of raw as EtherscanTokenTx[]) {
      if (!tx.from || tx.from.toLowerCase() !== lower) continue;
      if (tx.isError === "1") continue;
      if (!tx.to || tx.to.trim() === "") continue;
      if (!tx.hash) continue;

      let rawAmount: bigint;
      try {
        rawAmount = BigInt(tx.value || "0");
      } catch {
        continue;
      }
      if (rawAmount === 0n) continue;

      const decimals = parseInt(tx.tokenDecimal || "18", 10);
      const safeDecimals = Number.isFinite(decimals) && decimals >= 0 ? Math.min(decimals, 18) : 18;
      const symbol = (tx.tokenSymbol || "").trim() || "UNKNOWN";
      const contractAddress = (tx.contractAddress || "").trim();

      const timestamp = parseTimestamp(tx.timeStamp);
      txs.push({
        txHash: tx.hash,
        fromAddress: tx.from,
        toAddress: tx.to,
        amount: rawToDecimal(rawAmount, safeDecimals),
        amountRaw: rawAmount.toString(),
        timestamp,
        chain: this.chainName,
        tokenSymbol: symbol,
        tokenAddress: contractAddress,
        tokenDecimals: safeDecimals,
        transferType: "erc20",
      });
    }

    return txs;
  }

  // ── Paged Etherscan fetcher ─────────────────────────────────────────────────

  private async fetchAllPages(address: string, action: "txlist" | "tokentx"): Promise<unknown[]> {
    const pageSize = Math.min(Math.max(config.etherscan.txPageSize, 1), MAX_TX_RECORDS);
    const pageCeiling = Math.max(1, Math.floor(MAX_TX_RECORDS / pageSize));
    const maxPages = Math.min(Math.max(config.etherscan.txMaxPages, 1), pageCeiling);
    const all: unknown[] = [];

    for (let page = 1; page <= maxPages; page++) {
      let batch: unknown[] | null;
      try {
        batch = await etherscanClient.call<unknown[]>({
          chainid: this.chainId,
          module: "account",
          action,
          address,
          startblock: 0,
          endblock: 99999999,
          page,
          offset: pageSize,
          sort: config.etherscan.txSort,
        });
      } catch (error: unknown) {
        if (error instanceof EtherscanApiError && (error.kind === "AUTH" || error.kind === "PRO_REQUIRED")) {
          throw error;
        }
        const msg = error instanceof Error ? error.message : String(error);
        console.warn(`[EvmChainClient:${this.chainName}] ${address} ${action} page ${page}: ${msg}`);
        break;
      }

      if (!batch || batch.length === 0) break;
      all.push(...batch);
      if (batch.length < pageSize) break;
    }

    return all;
  }
}

function parseTimestamp(raw: string | undefined): string {
  const seconds = Number.parseInt(raw || "0", 10);
  return Number.isFinite(seconds) && seconds > 0
    ? new Date(seconds * 1000).toISOString()
    : new Date(0).toISOString();
}
