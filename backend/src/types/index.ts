export enum TraceStatus {
  QUEUED = "QUEUED",
  TRACING = "TRACING",
  LABELING = "LABELING",
  SCORING = "SCORING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
}

export enum LabelType {
  EXCHANGE = "EXCHANGE",
  MIXER = "MIXER",
  SANCTIONED = "SANCTIONED",
  UNLABELED = "UNLABELED",
}

export interface AddressLabel {
  id: string;
  address: string;
  chain: string;
  labelType: LabelType;
  entityName?: string | null;
  source?: string | null;
  confidence?: number | null;
  /** ISO timestamp of the last resolution; drives the label cache TTL. */
  updatedAt?: string | null;
}

export interface TraceRequest {
  id: string;
  caseId?: string | null;
  walletAddress: string;
  chain: string;
  status: TraceStatus;
  hopsTraced?: number | null;
  riskScore?: number | null;
  flaggedPatterns?: string | null;
  requestedAt: string; // ISO string
  completedAt?: string | null; // ISO string
  failureReason?: string | null;
}

export interface GraphNode {
  id: string;
  traceId: string;
  address: string;
  hopDepth: number;
  labelType?: LabelType | null;
  labelConfidence?: number | null;
  partialData: boolean;
}

export interface GraphEdge {
  id: string;
  traceId: string;
  fromAddress: string;
  toAddress: string;
  txHash: string;
  amount: string; // stringified numeric decimal for high precision
  txTimestamp?: string | null; // ISO string
  /** Token symbol for ERC-20/TRC-20 transfers (e.g. "USDT", "USDC"). Null for native transfers. */
  tokenSymbol?: string | null;
  /** Contract address of the token. Null for native ETH/TRX. */
  tokenAddress?: string | null;
  /** "native" | "erc20" | "trc20" */
  transferType?: string | null;
}

export interface ChainTransaction {
  txHash: string;
  fromAddress: string;
  toAddress: string;
  amount: string; // native coin or token amount, exact decimal string
  /** Raw smallest-unit value (wei / sun), kept for exact ordering. Internal only. */
  amountRaw?: string;
  timestamp: string; // ISO string
  chain: string;
  /** Token symbol for ERC-20 / TRC-20 transfers. Undefined for native transfers. */
  tokenSymbol?: string;
  /** Contract address of the token. Undefined for native transfers. */
  tokenAddress?: string;
  /** Token decimal places. Undefined for native transfers. */
  tokenDecimals?: number;
  /** How the value moved: native coin, ERC-20, or TRC-20. Default: "native". */
  transferType: "native" | "erc20" | "trc20";
}

export interface TraceRequestDto {
  walletAddress: string;
  /** Chain id ("ethereum", "tron") or "all" for a parallel multi-chain scan. */
  chain?: string;
  caseId?: string;
}

export interface NodeDto {
  address: string;
  hopDepth: number;
  labelType?: string | null;
  labelConfidence?: number | null;
}

export interface EdgeDto {
  fromAddress: string;
  toAddress: string;
  txHash: string;
  amount: string;
  txTimestamp?: string | null;
  tokenSymbol?: string | null;
  tokenAddress?: string | null;
  transferType?: string | null;
}

export interface ExchangeDto {
  address: string;
  entity?: string | null;
  hopDepth: number;
}

export interface MlVaspDto {
  address: string;
  basis: string;
  confidence: number;
  hops: number;
  received: number;
  reasons: string[];
}

export interface MlLayeringDto {
  type: string;
  nodes: string[];
  detail: string;
  max_anomaly?: number | null;
}

export interface MlAnomalyDto {
  address: string;
  anomaly: number;
  exchangeProb: number;
  flags: string[];
}

/**
 * Compact ML insights attached to a freshly traced result.
 * Present only when the Python ML service (ML_URL) was reachable during
 * the trace; absent on cached replays and when ML is disabled.
 */
export interface MlInsightDto {
  vasp: MlVaspDto | null;
  alternatives: MlVaspDto[];
  layering: MlLayeringDto[];
  /** UNLABELED nodes the model considers exchange-like, with SHAP reasons. */
  propagated: Array<{ address: string; similarity: number; like: string; basis: string; exchangeProb: number; reasons: string[] }>;
  /** Heuristic clusters: hot-wallet sweeps, consolidation:<addr>, siblings:<addr>, co-input:<tx>. */
  clusters: Record<string, string[]>;
  /** Top unsupervised outliers (Isolation Forest), highest first. */
  anomalies: MlAnomalyDto[];
  /** False below 8 traced nodes — scores would be fake all-zeros. */
  anomalyAvailable: boolean;
  /** Behavioural mixer suspects the model labelled without a registry hit. */
  suspectedMixers: Array<{ address: string; mixerProb: number; reasons: string[] }>;
  note?: string | null;
}

export interface TraceResultDto {
  id: string;
  caseId?: string | null;
  walletAddress: string;
  chain: string;
  status?: string | null;
  hopsTraced?: number | null;
  riskScore?: number | null;
  riskCategory?: string | null;
  flaggedPatterns?: string | null;
  requestedAt: string;
  completedAt?: string | null;
  failureReason?: string | null;
  servedFromCache: boolean;
  nearestExchange?: ExchangeDto | null;
  nodes: NodeDto[];
  edges: EdgeDto[];
  findings?: {
    summary: string;
    targetAddress: string;
    chain: string;
    traceDepth: number;
    nodes: number;
    transfers: number;
    entities: any[];
    keyPaths: any[];
  };
  provenance?: {
    sources: any[];
    fetchedAt: string;
    riskEngineVersion: string;
  };
  limitations?: string[];
  ml?: MlInsightDto | null;
  attribution?: {
    primary: any;
    confidence: {
      score: number;
      level: string;
      reasons: string[];
    };
  };
}

/** Metadata for a supported chain, returned by GET /api/chains. */
export interface ChainInfo {
  id: string;           // "ethereum" | "tron" | "all"
  name: string;
  nativeSymbol: string;
  tokens: string[];     // common tokens tracked on this chain
  multi?: boolean;      // true only for the "all" meta-entry
}

/**
 * Result of a parallel multi-chain scan (chain: "all").
 * Each chain runs its own BFS independently; results are merged here.
 */
export interface MultiChainTraceResultDto {
  /** Individual trace IDs keyed by chain, for follow-up GET requests. */
  traceIds: Record<string, string>;
  /** Per-chain result or an error string if that chain's trace failed. */
  perChain: Record<string, TraceResultDto | { error: string }>;
  /** Lowest hop-depth exchange found across all chains. */
  nearestExchange: ExchangeDto | null;
  /** Maximum risk score across all chains. */
  overallRiskScore: number;
  overallRiskCategory: string;
}
