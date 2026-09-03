import { GraphQLError } from "graphql";
import { config } from "../config.js";
import { KNOWN_ADDRESSES } from "../labels/knownAddresses.js";
const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
function requireAddress(address) {
    const trimmed = address.trim();
    if (!ADDRESS_RE.test(trimmed)) {
        throw new GraphQLError("walletAddress must be a 42-character 0x address", {
            extensions: { code: "BAD_USER_INPUT" },
        });
    }
    return trimmed;
}
/** DTO stores findings as a single " | "-joined string; GraphQL exposes a real list. */
function splitPatterns(patterns) {
    if (!patterns)
        return [];
    return patterns
        .split("|")
        .map((p) => p.trim())
        .filter((p) => p.length > 0);
}
function toTrace(dto) {
    return {
        ...dto,
        flaggedPatterns: splitPatterns(dto.flaggedPatterns),
        reportUrl: `/api/traces/${dto.id}/report`,
    };
}
export const resolvers = {
    Query: {
        trace: (_parent, args, ctx) => {
            const result = ctx.orchestrationService.get(args.id);
            return result ? toTrace(result) : null;
        },
        addressLabel: async (_parent, args, ctx) => {
            const address = requireAddress(args.address);
            const chain = (args.chain || "ethereum").toLowerCase();
            const resolved = await ctx.labelService.resolve(address, chain);
            return {
                address,
                chain,
                labelType: resolved.labelType,
                entityName: resolved.entityName,
                confidence: resolved.confidence,
                source: resolved.source,
            };
        },
        health: () => ({
            status: "UP",
            timestamp: new Date().toISOString(),
            etherscanConfigured: Boolean(config.etherscan.apiKey) && config.etherscan.apiKey !== "YourApiKeyToken",
            chainId: config.etherscan.chainId,
            labelRegistrySize: KNOWN_ADDRESSES.length,
        }),
    },
    Mutation: {
        submitTrace: async (_parent, args, ctx) => {
            const walletAddress = requireAddress(args.input.walletAddress);
            const result = await ctx.orchestrationService.submit({
                walletAddress,
                chain: args.input.chain || "ethereum",
                caseId: args.input.caseId || undefined,
            });
            return toTrace(result);
        },
    },
};
