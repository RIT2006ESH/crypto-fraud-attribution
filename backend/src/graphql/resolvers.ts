import { GraphQLError } from "graphql";
import { config } from "../config.js";
import { TraceOrchestrationService } from "../services/TraceOrchestrationService.js";
import { LabelService } from "../labels/LabelService.js";
import { KNOWN_ADDRESSES } from "../labels/knownAddresses.js";
import { TraceResultDto } from "../types/index.js";
import { describeAddressProblem, normalizeAddress } from "../util/address.js";

export interface GraphQLContext {
  orchestrationService: TraceOrchestrationService;
  labelService: LabelService;
}

/** Same normalisation and wording as the REST route; see util/address.ts. */
function requireAddress(address: string): string {
  const value = normalizeAddress(address);
  const problem = describeAddressProblem(value);
  if (problem) {
    throw new GraphQLError(problem, { extensions: { code: "BAD_USER_INPUT" } });
  }
  return value;
}

/** DTO stores findings as a single " | "-joined string; GraphQL exposes a real list. */
function splitPatterns(patterns: string | null | undefined): string[] {
  if (!patterns) return [];
  return patterns
    .split("|")
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

function toTrace(dto: TraceResultDto) {
  return {
    ...dto,
    flaggedPatterns: splitPatterns(dto.flaggedPatterns),
    reportUrl: `/api/traces/${dto.id}/report`,
    // Ensure token fields are always present in edges (nullable for native transfers).
    edges: (dto.edges || []).map((e) => ({
      ...e,
      tokenSymbol: e.tokenSymbol ?? null,
      tokenAddress: e.tokenAddress ?? null,
      transferType: e.transferType ?? "native",
    })),
  };
}

export const resolvers = {
  Query: {
    trace: (_parent: unknown, args: { id: string }, ctx: GraphQLContext) => {
      const result = ctx.orchestrationService.get(args.id);
      return result ? toTrace(result) : null;
    },

    addressLabel: async (
      _parent: unknown,
      args: { address: string; chain?: string | null },
      ctx: GraphQLContext
    ) => {
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

    chains: () => config.supportedChains,
  },

  Mutation: {
    submitTrace: async (
      _parent: unknown,
      args: { input: { walletAddress: string; chain?: string | null; caseId?: string | null } },
      ctx: GraphQLContext
    ) => {
      const walletAddress = requireAddress(args.input.walletAddress);
      const result = await ctx.orchestrationService.submit({
        walletAddress,
        chain: args.input.chain || "all",
        caseId: args.input.caseId || undefined,
      });
      // submitTrace returns a single-chain TraceResultDto when a specific chain or
      // auto-detected chain is used.  For "all", the orchestrator fans out but still
      // returns the first successful chain's result via the Trace type.
      // (Multi-chain full result shape is only via the REST endpoint for MVP.)
      const dto = "perChain" in result
        ? Object.values(result.perChain).find((r): r is TraceResultDto => !("error" in r)) ?? {
            id: "multi",
            walletAddress,
            chain: "all",
            status: "COMPLETED",
            requestedAt: new Date().toISOString(),
            servedFromCache: false,
            nodes: [],
            edges: [],
            flaggedPatterns: null,
            nearestExchange: result.nearestExchange ?? null,
            riskScore: result.overallRiskScore,
            riskCategory: result.overallRiskCategory,
          } as unknown as TraceResultDto
        : result as TraceResultDto;
      return toTrace(dto);
    },
  },
};
