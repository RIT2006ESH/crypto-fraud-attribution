export type LabelType = 'EXCHANGE' | 'MIXER' | 'SANCTIONED' | 'UNLABELED';
export type TransferType = 'native' | 'erc20' | 'trc20';

export interface NodeDto {
  address: string;
  hopDepth: number;
  labelType: LabelType | null;
  labelConfidence: number | null;
}

export interface EdgeDto {
  fromAddress: string;
  toAddress: string;
  txHash: string;
  amount: string | number;
  txTimestamp: string | null;
  /** Token symbol for ERC-20/TRC-20 transfers. Null for native ETH/TRX. */
  tokenSymbol: string | null;
  /** Contract address of the token. Null for native. */
  tokenAddress: string | null;
  /** "native" | "erc20" | "trc20" */
  transferType: TransferType | null;
}

export interface ExchangeDto {
  address: string;
  entity: string | null;
  hopDepth: number;
}

export interface TraceResult {
  id: string;
  caseId: string | null;
  walletAddress: string;
  chain: string;
  status: string;
  hopsTraced: number | null;
  riskScore: number | null;
  riskCategory: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | null;
  flaggedPatterns: string | null;
  requestedAt: string | null;
  completedAt: string | null;
  failureReason: string | null;
  servedFromCache: boolean;
  nearestExchange: ExchangeDto | null;
  nodes: NodeDto[];
  edges: EdgeDto[];
}

export interface TraceInput {
  walletAddress: string;
  /** "ethereum" | "tron" | "all" */
  chain: string;
  caseId?: string;
}

/** Metadata for a supported blockchain, returned by GET /api/chains. */
export interface ChainInfo {
  id: string;
  name: string;
  nativeSymbol: string;
  tokens: string[];
  multi?: boolean;
}

/**
 * Response shape when chain="all" — backend fans out and returns per-chain results.
 * api.ts normalises this into a plain TraceResult so components don't need to know.
 */
export interface MultiChainTraceResult {
  traceIds: Record<string, string>;
  perChain: Record<string, TraceResult | { error: string }>;
  nearestExchange: ExchangeDto | null;
  overallRiskScore: number;
  overallRiskCategory: string;
}

