export interface Case {
  id: string;
  caseReference: string;
  title: string | null;
  status: "OPEN" | "CLOSED";
  createdAt: string;
  updatedAt: string;
  targetAddress: string | null;
  targetChain: string | null;
  riskLevel: string | null;
  riskScore: number | null;
}

export interface AuditEvent {
  id: string;
  caseId: string | null;
  investigationId: string | null;
  eventType: string;
  eventTime: string;
  actorType: string;
  metadataJson: string | null;
}
