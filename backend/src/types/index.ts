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
  requestedAt: string;
  completedAt?: string | null;
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
  amount: string;
  txTimestamp?: string | null;
}

export interface GraphCache {
  traceId: string;
  graphJson: string;
  createdAt: string;
}

export interface ChainTransaction {
  hash: string;
  from: string;
  to: string;
  amount: string;
  timestamp: string;
  chain?: string;
}

export interface TraceRequestDto {
  walletAddress: string;
  chain?: string;
  caseId?: string;
}

export interface NodeDto {
  id: string;
  address: string;
  type: string;
  hopDepth: number;
  confidence?: number | null;
  labelType?: string | null;
  labelConfidence?: number | null;
}

export interface EdgeDto {
  id: string;
  from: string;
  to: string;
  txHash: string;
  amount: string;
  timestamp: string;
  fromAddress?: string;
  toAddress?: string;
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
