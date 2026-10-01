export enum ReportStatus {
  GENERATING = "GENERATING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
}

export interface Report {
  id: string;
  investigationId: string;
  caseId: string | null;
  reportVersion: number;
  generatedAt: string;
  generatedBy: string | null;
  status: ReportStatus;
  reportHash: string | null;
  reportPath: string | null;
  pageCount: number | null;
  fileSize: number | null;
  reportDataJson: string | null;
}
