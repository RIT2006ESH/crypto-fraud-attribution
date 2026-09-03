export type LabelType = 'EXCHANGE' | 'MIXER' | 'SANCTIONED' | 'UNLABELED';

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
  chain: string;
  caseId?: string;
}
