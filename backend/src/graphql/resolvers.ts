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

function requireAddress(address: string): string {
  const value = normalizeAddress(address);
  const problem = describeAddressProblem(value);
  if (problem) {
    throw new GraphQLError(problem, { extensions: { code: "INVALID_ADDRESS" } });
  }
  return value;
}

function splitPatterns(patterns: string | null | undefined): string[] {
  if (!patterns) return [];
  return patterns
    .split("|")
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

function toInvestigation(dto: TraceResultDto) {
  const isFailed = dto.status === "FAILED";
  const isPartial = dto.status === "PARTIAL";

  // Aggregate Edges
  const edgesMap = new Map<string, any>();
  const nodes = dto.nodes || [];
  const rawEdges = dto.edges || [];

  rawEdges.forEach((e) => {
    const key = `${e.fromAddress}-${e.toAddress}-${dto.chain}-${e.tokenSymbol || 'native'}`;
    if (!edgesMap.has(key)) {
      edgesMap.set(key, {
        id: key,
        source: e.fromAddress,
        target: e.toAddress,
        chain: dto.chain,
        asset: e.tokenSymbol || 'native',
        assetType: e.transferType || 'native',
        transferCount: 0,
        aggregateAmount: 0n,
        firstSeen: e.txTimestamp,
        lastSeen: e.txTimestamp,
        isKeyPath: false,
        riskLevel: "LOW",
        transactionIds: [],
      });
    }
    const agg = edgesMap.get(key);
    agg.transferCount += 1;
    try {
        // basic aggregation, assuming we can sum float strings roughly, 
        // ideally use a bignumber lib but this is for demonstration.
        agg.aggregateAmount += BigInt(Math.floor(parseFloat(e.amount) * 1e18));
    } catch {}
    if (!agg.firstSeen || (e.txTimestamp && e.txTimestamp < agg.firstSeen)) agg.firstSeen = e.txTimestamp;
    if (!agg.lastSeen || (e.txTimestamp && e.txTimestamp > agg.lastSeen)) agg.lastSeen = e.txTimestamp;
    agg.transactionIds.push(e.txHash);
  });

  const graphEdges = Array.from(edgesMap.values()).map(e => ({
      ...e,
      aggregateAmount: (Number(e.aggregateAmount) / 1e18).toString()
  }));

  const graphNodes = nodes.map((n) => {
    const isTarget = n.address.toLowerCase() === dto.walletAddress.toLowerCase();
    const isKnownEntity = !!n.labelType && n.labelType !== 'UNLABELED';
    return {
      id: n.address,
      address: n.address,
      chain: dto.chain,
      entityName: null,
      entityType: n.labelType || "UNLABELED",
      label: n.labelType || "UNLABELED",
      hop: n.hopDepth,
      isTarget,
      isKnownEntity,
      riskLevel: "LOW",
      attributionConfidence: n.labelConfidence || 0,
      transferCount: 0,
      incomingCount: 0,
      outgoingCount: 0,
    };
  });

  return {
    id: dto.id,
    status: dto.status === "FAILED" ? "FAILED" : (dto.status === "PARTIAL" ? "PARTIAL" : "COMPLETED"),
    metadata: {
      caseReference: dto.caseId,
      walletAddress: dto.walletAddress,
      chain: dto.chain,
      requestedAt: dto.requestedAt,
      completedAt: dto.completedAt,
      failureReason: dto.failureReason,
    },
    graph: isFailed ? null : {
      nodes: graphNodes,
      edges: graphEdges,
    },
    ledger: rawEdges.map((e) => ({
      ...e,
      tokenSymbol: e.tokenSymbol ?? null,
      tokenAddress: e.tokenAddress ?? null,
      transferType: e.transferType ?? "native",
    })),
    attribution: {
      nearestExchange: dto.nearestExchange,
    },
    risk: {
      score: dto.riskScore,
      category: dto.riskCategory,
    },
    findings: splitPatterns(dto.flaggedPatterns),
    provenance: {
      servedFromCache: dto.servedFromCache,
      reportUrl: `/api/traces/${dto.id}/report`,
    },
  };
}

export const resolvers = {
  Query: {
    investigation: (_parent: unknown, args: { id: string }, ctx: GraphQLContext) => {
      const result = ctx.orchestrationService.get(args.id);
      return result ? toInvestigation(result) : null;
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
    submitInvestigation: async (
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

      return toInvestigation(dto);
    },
  },
};
