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

/** Exact wei -> ETH decimal string; no float rounding. */
export function weiToEth(wei: bigint): string {
  const whole = wei / WEI_PER_ETH;
  const fraction = (wei % WEI_PER_ETH).toString().padStart(18, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

export class EthereumChainClient implements ChainClient {
  chain(): string {
    return "ethereum";
  }

  /**
   * Outgoing native-ETH transfers for an address, largest first.
   *
   * Throws on auth/plan failures so a misconfigured key shows up as a FAILED trace with a
   * reason. An empty array here means "this wallet really has no outgoing transfers".
   */
  async getOutgoingTransactions(address: string): Promise<ChainTransaction[]> {
    const raw = await this.fetchAllPages(address);
    const lower = address.toLowerCase();
    const txs: ChainTransaction[] = [];

    for (const tx of raw) {
      if (!tx.from || tx.from.toLowerCase() !== lower) continue; // outgoing only
      if (tx.isError === "1" || tx.txreceipt_status === "0") continue; // reverted
      if (!tx.to || tx.to.trim() === "") continue; // contract creation
      if (!tx.hash) continue;

      let wei: bigint;
      try {
        wei = BigInt(tx.value || "0");
      } catch {
        continue;
      }
      if (wei === 0n) continue; // no value moved

      const seconds = Number.parseInt(tx.timeStamp || "0", 10);
      const timestamp = Number.isFinite(seconds) && seconds > 0
        ? new Date(seconds * 1000).toISOString()
        : new Date(0).toISOString();

      txs.push({
        txHash: tx.hash,
        fromAddress: tx.from,
        toAddress: tx.to,
        amount: weiToEth(wei),
        amountWei: wei.toString(),
        timestamp,
        chain: "ethereum",
      });
    }

    // Exact ordering on wei; float compare loses precision above 2^53.
    txs.sort((a, b) => {
      const av = BigInt(a.amountWei ?? "0");
      const bv = BigInt(b.amountWei ?? "0");
      return av === bv ? 0 : bv > av ? 1 : -1;
    });

    return txs;
  }

  private async fetchAllPages(address: string): Promise<EtherscanTx[]> {
    const pageSize = Math.min(Math.max(config.etherscan.txPageSize, 1), MAX_TX_RECORDS);
    const pageCeiling = Math.max(1, Math.floor(MAX_TX_RECORDS / pageSize));
    const maxPages = Math.min(Math.max(config.etherscan.txMaxPages, 1), pageCeiling);
    const all: EtherscanTx[] = [];

    for (let page = 1; page <= maxPages; page++) {
      let batch: EtherscanTx[] | null;
      try {
        batch = await etherscanClient.call<EtherscanTx[]>({
          module: "account",
          action: "txlist",
          address,
          startblock: 0,
          endblock: 99999999,
          page,
          offset: pageSize,
          sort: config.etherscan.txSort,
        });
      } catch (error: unknown) {
        // A bad key or blocked plan is fatal for the whole trace, not just this address.
        if (error instanceof EtherscanApiError && (error.kind === "AUTH" || error.kind === "PRO_REQUIRED")) {
          throw error;
        }
        const msg = error instanceof Error ? error.message : String(error);
        console.warn(`[EthereumChainClient] ${address} page ${page}: ${msg}`);
        break; // keep whatever we already have rather than losing the hop
      }

      if (!batch || batch.length === 0) break;
      all.push(...batch);
      if (batch.length < pageSize) break; // last page
    }

    return all;
  }
}
