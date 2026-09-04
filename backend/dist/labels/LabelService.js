import { config } from "../config.js";
import { EtherscanApiError, etherscanClient } from "../chain/EtherscanClient.js";
import { addressLabelRepository } from "../db/database.js";
import { LabelType } from "../types/index.js";
import { lookupKnownAddress } from "./knownAddresses.js";
const UNLABELED = {
    labelType: LabelType.UNLABELED,
    entityName: null,
    confidence: null,
    source: "unresolved",
};
const MIXER_HINTS = ["tornado", "mixer", "tumbler", "blender", "sinbad", "railgun"];
const EXCHANGE_HINTS = [
    "exchange",
    "binance",
    "coinbase",
    "kraken",
    "bitfinex",
    "okx",
    "huobi",
    "htx",
    "gate.io",
    "gateio",
    "crypto.com",
    "kucoin",
    "bybit",
    "bitstamp",
    "gemini",
    "wazirx",
    "coindcx",
    "zebpay",
    "bitbns",
];
const SANCTION_HINTS = ["ofac", "sanction", "sdn", "lazarus", "phish", "hack", "exploit", "heist", "stolen"];
function matches(haystack, needles) {
    return haystack.some((h) => needles.some((n) => h.includes(n)));
}
/**
 * Resolves what an address *is* — exchange, mixer, sanctioned, or unknown.
 *
 * Order of precedence, first hit wins:
 *   1. SQLite cache (within LABELS_CACHE_TTL_HOURS)
 *   2. curated registry in knownAddresses.ts
 *   3. Etherscan module=nametag (Pro Plus only; auto-skipped on free keys)  — EVM chains only
 *   4. on-chain heuristics — verified contract name keywords              — EVM chains only
 *
 * Tron addresses skip steps 3 and 4 because Etherscan has no knowledge of the Tron chain.
 * Every resolution, including UNLABELED, is written back to the cache so a repeat trace
 * of the same subgraph costs no extra API calls.
 */
export class LabelService {
    nametagUnavailableLogged = false;
    async resolve(address, chain, opts = {}) {
        const cached = addressLabelRepository.findFresh(address, chain, config.labels.cacheTtlHours);
        if (cached) {
            return {
                labelType: cached.labelType,
                entityName: cached.entityName ?? null,
                confidence: cached.confidence ?? null,
                source: cached.source ?? "cache",
            };
        }
        const known = lookupKnownAddress(address, chain);
        if (known) {
            return this.persist(address, chain, {
                labelType: known.labelType,
                entityName: known.entityName,
                confidence: known.confidence,
                source: known.source,
            });
        }
        // Etherscan enrichment is only applicable to EVM chains.
        const isEvm = chain !== "tron";
        const shouldEnrich = opts.enrich !== false && config.labels.enrichFromChain && isEvm;
        if (!shouldEnrich) {
            return this.persist(address, chain, UNLABELED);
        }
        const fromNametag = await this.fromNametag(address);
        if (fromNametag) {
            return this.persist(address, chain, fromNametag);
        }
        const fromContract = await this.fromContractName(address);
        if (fromContract) {
            return this.persist(address, chain, fromContract);
        }
        // Cache the miss too — an address with no attribution stays unattributed.
        return this.persist(address, chain, UNLABELED);
    }
    persist(address, chain, label) {
        try {
            addressLabelRepository.save({
                address,
                chain,
                labelType: label.labelType,
                entityName: label.entityName,
                source: label.source,
                confidence: label.confidence,
            });
        }
        catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            console.warn(`[LabelService] could not cache label for ${address}: ${msg}`);
        }
        return label;
    }
    /** Etherscan's own address tags. PRO Plus; degrades to null on free keys. */
    async fromNametag(address) {
        if (etherscanClient.isGated("getaddresstag"))
            return null;
        try {
            const result = await etherscanClient.call({
                module: "nametag",
                action: "getaddresstag",
                address,
            });
            const entry = Array.isArray(result) ? result[0] : undefined;
            if (!entry)
                return null;
            const slugs = (entry.labels_slug ?? []).map((s) => s.toLowerCase());
            const names = (entry.labels ?? []).map((s) => s.toLowerCase());
            const tags = [...slugs, ...names, (entry.nametag ?? "").toLowerCase()].filter(Boolean);
            const entityName = entry.nametag || entry.labels?.[0] || null;
            let labelType = LabelType.UNLABELED;
            if (matches(tags, SANCTION_HINTS))
                labelType = LabelType.SANCTIONED;
            else if (matches(tags, MIXER_HINTS))
                labelType = LabelType.MIXER;
            else if (matches(tags, EXCHANGE_HINTS))
                labelType = LabelType.EXCHANGE;
            if (labelType === LabelType.UNLABELED && !entityName)
                return null;
            return { labelType, entityName, confidence: 0.9, source: "etherscan:nametag" };
        }
        catch (error) {
            if (error instanceof EtherscanApiError && error.kind === "PRO_REQUIRED") {
                if (!this.nametagUnavailableLogged) {
                    this.nametagUnavailableLogged = true;
                    console.warn("[LabelService] Etherscan address-label endpoint needs a Pro Plus key; " +
                        "using the built-in registry and contract heuristics instead.");
                }
                return null;
            }
            if (error instanceof EtherscanApiError && error.kind === "AUTH")
                throw error;
            return null;
        }
    }
    /**
     * Free-tier fallback: a verified contract's own name is often self-identifying
     * ("TornadoCash_Proxy", "BinanceForwarder"). EOAs and unverified contracts return an
     * empty ContractName, in which case there is nothing to infer and we return null.
     */
    async fromContractName(address) {
        try {
            const result = await etherscanClient.call({
                module: "contract",
                action: "getsourcecode",
                address,
            });
            const contractName = (Array.isArray(result) ? result[0]?.ContractName : "") ?? "";
            if (!contractName.trim())
                return null;
            const tag = contractName.toLowerCase();
            let labelType = LabelType.UNLABELED;
            if (matches([tag], SANCTION_HINTS))
                labelType = LabelType.SANCTIONED;
            else if (matches([tag], MIXER_HINTS))
                labelType = LabelType.MIXER;
            else if (matches([tag], EXCHANGE_HINTS))
                labelType = LabelType.EXCHANGE;
            return {
                labelType,
                entityName: `Contract: ${contractName}`,
                // Name-based inference is weaker evidence than a curated listing.
                confidence: labelType === LabelType.UNLABELED ? 0.3 : 0.6,
                source: "etherscan:contract-name",
            };
        }
        catch {
            return null;
        }
    }
}
