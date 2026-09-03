import { LabelType } from "../types/index.js";
/**
 * Curated attribution registry — the intelligence that used to live in seed-labels.csv.
 *
 * It is kept in code rather than a data file because it is the one input that cannot be
 * derived from chain data: which anonymous-looking address belongs to which real entity.
 * Etherscan's own label endpoint (module=nametag) is Pro Plus only, so on a free key this
 * registry plus the on-chain heuristics in LabelService are the whole labelling story.
 *
 * Everything here is public, widely-published attribution (exchange hot wallets, the
 * Tornado Cash pools, OFAC SDN listings). Add to it as an investigation confirms an entity.
 */
const EXCHANGE_WALLETS = {
    Binance: [
        ["0x28C6c06298d514Db089934071355E5743bf21d60", 0.95],
        ["0x21a31Ee1afC51d94C2eFcCAa2092aD1028285549", 0.95],
        ["0xDFd5293D8e347dFe59E90eFd55b2956a1343963d", 0.95],
        ["0x56Eddb7aa87536c09CCc2793473599fD21A8b17F", 0.95],
        ["0x9696f59E4d72E237BE84fFD425DCaD154Bf96976", 0.95],
        ["0x4976A4A02f38326660D17bf34b431dC6e2eb2327", 0.9],
        ["0xfE9e8709d3215310075d67E3ed32A380CCf451C8", 0.9],
    ],
    Coinbase: [
        ["0x71660c4005BA85c37ccec55d0C4493E66Fe775d3", 0.95],
        ["0x503828976D22510aad0201ac7EC88293211D23Da", 0.95],
        ["0xdDfAbCdc4D8FfC6d5beaf154f18B778f892A0740", 0.95],
        ["0x3cD751E6b0078Be393132286c442345e5DC49699", 0.95],
        ["0xb5d85CBf7cB3EE0D56b3bB207D5Fc4B82f43F511", 0.9],
        ["0xeB2629a2734e272Bcc07BDA959863f316F4bD4Cf", 0.9],
        ["0xA9D1e08C7793af67e9d92fe308d5697FB81d3E43", 0.9],
    ],
    Kraken: [
        ["0x2910543Af39abA0Cd09dBb2D50200b3E800A63D2", 0.95],
        ["0x0A869d79a7052C7f1b55a8EbAbbEa3420F0D1E13", 0.95],
        ["0xE853c56864A2ebe4576a807D26Fdc4A0adA51919", 0.95],
        ["0x267be1C1D684F78cb4F6a176C4911b741E4Ffdc0", 0.9],
    ],
    Bitfinex: [
        ["0x77134cbC06cB00b66F4c7e623D5fdBF6777635EC", 0.9],
        ["0x876EabF441B2EE5B5b0554Fd502a8E0600950cFa", 0.9],
    ],
    OKX: [
        ["0x6cC5F688a315f3dC28A7781717a9A798a59fDA7b", 0.9],
        ["0x236F9F97e0E62388479bf9E5BA4889e46B0273C3", 0.9],
    ],
    "HTX (Huobi)": [
        ["0xaB5C66752a9e8167967685F1450532fB96d5d24f", 0.9],
        ["0xE93381fB4c4F14bDa253907b18faD305D799241a", 0.9],
    ],
    "Gate.io": [
        ["0x0D0707963952f2fBA59dD06f2b425ace40b492Fe", 0.9],
        ["0x7793cD85c11a924478d358D49b05b37E91B5810F", 0.9],
    ],
    "Crypto.com": [
        ["0x6262998Ced04146fA42253a5C0AF90CA02dfd2A3", 0.9],
        ["0x46340b20830761efd32832A74d7169B29FEB9758", 0.9],
    ],
};
const MIXER_WALLETS = [
    ["0x12D66f87A04A9E220743712cE6d9bB1B5616B8Fc", "Tornado Cash 0.1 ETH pool", 0.99],
    ["0x47CE0C6eD5B0Ce3d3A51fdb1C52DC66a7c3c2936", "Tornado Cash 1 ETH pool", 0.99],
    ["0x910Cbd523D972eb0a6f4cAe4618aD62622b39DbF", "Tornado Cash 10 ETH pool", 0.99],
    ["0xA160cdAB225685dA1d56aa342Ad8841c3b53f291", "Tornado Cash 100 ETH pool", 0.99],
    ["0x8589427373D6D84E98730D7795D8f6f8731FDA16", "Tornado Cash router", 0.95],
    ["0x722122dF12D4e14e13Ac3b6895a86e84145b6967", "Tornado Cash proxy", 0.95],
];
const SANCTIONED_WALLETS = [
    ["0x098B716B8Aaf21512996dC57EB0615e2383E2f96", "Lazarus Group (Ronin Bridge exploit)", 0.99],
];
const CHAIN = "ethereum";
function build() {
    const out = [];
    for (const [entityName, wallets] of Object.entries(EXCHANGE_WALLETS)) {
        for (const [address, confidence] of wallets) {
            out.push({
                address,
                chain: CHAIN,
                labelType: LabelType.EXCHANGE,
                entityName,
                source: "registry:public-labels",
                confidence,
            });
        }
    }
    for (const [address, entityName, confidence] of MIXER_WALLETS) {
        out.push({
            address,
            chain: CHAIN,
            labelType: LabelType.MIXER,
            entityName,
            source: "registry:ofac-2022 delisted-2025-03",
            confidence,
        });
    }
    for (const [address, entityName, confidence] of SANCTIONED_WALLETS) {
        out.push({
            address,
            chain: CHAIN,
            labelType: LabelType.SANCTIONED,
            entityName,
            source: "registry:ofac-sdn",
            confidence,
        });
    }
    return out;
}
export const KNOWN_ADDRESSES = build();
/** Lower-cased "chain:address" -> label, for O(1) lookup during a trace. */
const INDEX = new Map(KNOWN_ADDRESSES.map((entry) => [`${entry.chain}:${entry.address.toLowerCase()}`, entry]));
export function lookupKnownAddress(address, chain) {
    return INDEX.get(`${chain.toLowerCase()}:${address.toLowerCase()}`);
}
