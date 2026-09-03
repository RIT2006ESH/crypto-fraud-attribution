import axios from "axios";
import { config } from "../config/index.js";
const WEI_PER_ETH = 10n ** 18n;
export class EthereumChainClient {
    baseUrl;
    apiKey;
    constructor() {
        this.baseUrl = config.etherscan.baseUrl;
        this.apiKey = config.etherscan.apiKey;
    }
    chain() {
        return "ethereum";
    }
    async getNormalTransactions(address) {
        return this.fetchFromEtherscan("account", "txlist", address);
    }
    async getInternalTransactions(address) {
        return this.fetchFromEtherscan("account", "txlistinternal", address);
    }
    async getTokenTransfers(address) {
        return this.fetchFromEtherscan("account", "tokentx", address);
    }
    async getOutgoingTransactions(address) {
        const normal = await this.getNormalTransactions(address);
        const lower = address.toLowerCase();
        return normal.filter((tx) => tx.from.toLowerCase() === lower);
    }
    async fetchFromEtherscan(moduleName, actionName, address) {
        try {
            const response = await axios.get(this.baseUrl, {
                params: {
                    chainid: 1,
                    module: moduleName,
                    action: actionName,
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
            const txs = [];
            for (const tx of data.result) {
                if (tx.isError === "1")
                    continue;
                if (!tx.to || tx.to.trim() === "")
                    continue;
                try {
                    const weiBigInt = BigInt(tx.value || "0");
                    if (weiBigInt === 0n && actionName === "txlist")
                        continue;
                    const integerPart = weiBigInt / WEI_PER_ETH;
                    const remainderPart = weiBigInt % WEI_PER_ETH;
                    const remainderStr = remainderPart.toString().padStart(18, "0");
                    const amountEthStr = `${integerPart}.${remainderStr}`.replace(/\.?0+$/, "") || "0";
                    const timeStampSec = parseInt(tx.timeStamp || "0", 10);
                    const isoTimestamp = new Date(timeStampSec * 1000).toISOString();
                    txs.push({
                        hash: tx.hash,
                        from: tx.from,
                        to: tx.to,
                        amount: amountEthStr,
                        timestamp: isoTimestamp,
                        chain: "ethereum",
                    });
                }
                catch {
                    continue;
                }
            }
            return txs;
        }
        catch (error) {
            console.warn(`[EthereumChainClient] Etherscan call failed for ${address} (${actionName}): ${error.message}`);
            return [];
        }
    }
}
