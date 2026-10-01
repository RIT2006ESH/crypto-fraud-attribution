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

/** A path through the traced subgraph that the service considers notable. */
export interface KeyPathDto {
  pathId: string;
  addresses: string[];
  hops: number;
  significance: string;
}

export interface TraceEntityDto {
  address: string;
  hopDepth: number;
  labelType?: LabelType | string | null;
  confidence?: number | null;
}

export interface AttributionConfidenceDto {
  score: number;
  level: string;
  reasons: string[];
}

export interface AttributionPrimaryDto {
  address: string;
  entity?: string | null;
  hopDepth: number;
}

export interface AttributionDto {
  primary: AttributionPrimaryDto;
  confidence: AttributionConfidenceDto;
}

/**
 * The service's own summary of the trace.
 *
 * Present on every completed response. It restates the coverage of this trace — which is
 * useful context beside a risk score, because a score over one node is not comparable to
 * a score over sixty.
 */
export interface FindingsDto {
  summary: string;
  targetAddress: string;
  chain: string;
  traceDepth: number;
  nodes: number;
  transfers: number;
  entities: TraceEntityDto[];
  keyPaths: KeyPathDto[];
}

/** Where the data behind a trace came from, and which risk engine scored it. */
export interface ProvenanceDto {
  sources: { provider: string }[];
  fetchedAt: string;
  riskEngineVersion: string;
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
  /**
   * Human-readable risk signals, joined with " | ". When no weighted rule fires the
   * backend stores the sentence "No high-risk patterns detected" rather than an empty
   * string, so consumers must not treat a non-empty value as proof of a finding.
   */
  flaggedPatterns: string | null;
  requestedAt: string | null;
  completedAt: string | null;
  failureReason: string | null;
  /** Reasons the trace could not be completed in full, as reported by the service. */
  limitations: string[] | null;
  servedFromCache: boolean;
  nearestExchange: ExchangeDto | null;
  nodes: NodeDto[];
  edges: EdgeDto[];
  /**
   * Compact ML insights (XGBoost/SHAP, Isolation Forest, propagation +
   * clustering, layering rules). Present only on fresh traces when the
   * Python ML service was reachable; absent on cached replays.
   */
  ml?: {
    vasp: { address: string; basis: string; confidence: number; hops: number; received: number; reasons: string[] } | null;
    alternatives: { address: string; basis: string; confidence: number; hops: number; received: number; reasons: string[] }[];
    layering: { type: string; nodes: string[]; detail: string; max_anomaly?: number | null }[];
    propagated: { address: string; similarity: number; like: string; basis: string; exchangeProb: number; reasons: string[] }[];
    clusters: Record<string, string[]>;
    anomalies: { address: string; anomaly: number; exchangeProb: number; flags: string[] }[];
    anomalyAvailable: boolean;
    suspectedMixers: { address: string; mixerProb: number; reasons: string[] }[];
    note?: string | null;
  } | null;
  findings: FindingsDto | null;
  provenance: ProvenanceDto | null;
  attribution?: AttributionDto | null;
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

export type InvestigationStatus = 
  | "idle"
  | "validating"
  | "queued"
  | "running"
  | "processing"
  | "completed"
  | "partial"
  | "failed";

export interface Attribution {
  entity: string;
  type: string;
  confidence: number;
  confidenceCategory: 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN';
  reasoning: string[];
}

export interface Finding {
  id: string;
  title: string;
  hopDepth: number;
  description: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
}

export interface InvestigationState {
  request: {
    walletAddress: string;
    chain: string;
    caseReference?: string;
  };
  execution: {
    status: InvestigationStatus;
    progress: number;
    currentStage: string;
    startedAt: string | null;
    completedAt: string | null;
  };
  result: TraceResult | null;
  focus: {
    nodeId: string | null;
    edgeId: string | null;
    address: string | null;
    txHash: string | null;
  };
  ui: {
    activeView: 'DEFAULT' | 'RISK_FOCUS' | 'ENTITY_FOCUS' | 'PATH_FOCUS';
  };
}
