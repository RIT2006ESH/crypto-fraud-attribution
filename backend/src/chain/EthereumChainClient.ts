import axios from "axios";
import { config } from "../config.js";
import { ChainTransaction } from "../types/index.js";

const WEI_PER_ETH = 10n ** 18n;

export interface ChainClient {
  chain(): string;
  getOutgoingTransactions(address: string): Promise<ChainTransaction[]>;
}

export class EthereumChainClient implements ChainClient {
  private baseUrl: string;
  private apiKey: string;

  constructor() {
    this.baseUrl = config.etherscan.baseUrl;
    this.apiKey = config.etherscan.apiKey;
  }

  chain(): string {
    return "ethereum";
  }

  async getOutgoingTransactions(address: string): Promise<ChainTransaction[]> {
    try {
      const response = await axios.get(this.baseUrl, {
        params: {
          chainid: 1,
          module: "account",
          action: "txlist",
          address,
          startblock: 0,
          endblock: 99999999,
          sort: "asc",
          apikey: this.apiKey,
        },
        timeout: 10000,
      });

      const data = response.data;
      if (!data || !Array.isArray(data.result)) {
        return [];
      }

      const txs: ChainTransaction[] = [];
      const lowerAddress = address.toLowerCase();

      for (const tx of data.result) {
        if (!tx.from || tx.from.toLowerCase() !== lowerAddress) {
          continue; // Outgoing only: funds leaving this wallet
        }
        if (tx.isError === "1") {
          continue; // Skip reverted transactions
        }
        if (!tx.to || tx.to.trim() === "") {
          continue; // Contract creation, no recipient
        }

        try {
          const weiBigInt = BigInt(tx.value || "0");
          if (weiBigInt === 0n) {
            continue; // Zero value tx
          }

          // Format wei to ETH string with precision
          const integerPart = weiBigInt / WEI_PER_ETH;
          const remainderPart = weiBigInt % WEI_PER_ETH;
          const remainderStr = remainderPart.toString().padStart(18, "0");
          const amountEthStr = `${integerPart}.${remainderStr}`.replace(/\.?0+$/, "") || "0";

          const timeStampSec = parseInt(tx.timeStamp || "0", 10);
          const isoTimestamp = new Date(timeStampSec * 1000).toISOString();

          txs.push({
            txHash: tx.hash,
            fromAddress: tx.from,
            toAddress: tx.to,
            amount: amountEthStr,
            timestamp: isoTimestamp,
            chain: "ethereum",
          });
        } catch (e) {
          // Skip unparseable amount
          continue;
        }
      }

      return txs;
    } catch (error: any) {
      console.warn(`[EthereumChainClient] Etherscan call failed for ${address}: ${error.message}`);
      return [];
    }
  }
}
