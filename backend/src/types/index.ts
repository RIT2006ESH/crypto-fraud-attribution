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
}

export interface ChainTransaction {
  txHash: string;
  fromAddress: string;
  toAddress: string;
  amount: string; // native ETH
  timestamp: string; // ISO string
  chain: string;
}

export interface TraceRequestDto {
  walletAddress: string;
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
}

export interface ExchangeDto {
  address: string;
  entity?: string | null;
  hopDepth: number;
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
}
