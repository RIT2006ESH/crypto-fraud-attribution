import { Router, Request, Response } from "express";
import { TraceOrchestrationService } from "../services/TraceOrchestrationService.js";
import { ReportService } from "../services/ReportService.js";
import { reportRepository } from "../db/database.js";
import fs from "fs";

export function createReportRouter(orchestrationService: TraceOrchestrationService): Router {
  const router = Router();
  const reportService = new ReportService();

  // POST /api/investigations/:id/report
  router.post("/:id/report", async (req: Request, res: Response) => {
    try {
      const id = String(req.params.id);
      const result = orchestrationService.get(id);
      if (!result) {
        res.status(404).json({ error: "INVESTIGATION_NOT_FOUND" });
        return;
      }
      const report = await reportService.generateReport(result);
      res.status(200).json({
        reportId: report.id,
        status: report.status,
        sha256: report.reportHash,
        generatedAt: report.generatedAt,
        pageCount: report.pageCount,
        fileSizeBytes: report.fileSize
      });
    } catch (error: any) {
      console.error("[ReportController] Error generating report:", error);
      res.status(500).json({ error: "REPORT_GENERATION_FAILED" });
    }
  });

  // GET /api/reports/:id
  router.get("/:id", (req: Request, res: Response) => {
    const report = reportRepository.findById(String(req.params.id));
    if (!report) {
      res.status(404).json({ error: "REPORT_NOT_FOUND" });
      return;
    }
    res.status(200).json(report);
  });

  // GET /api/reports/:id/download
  router.get("/:id/download", (req: Request, res: Response) => {
    const report = reportRepository.findById(String(req.params.id));
    if (!report || !report.reportPath || !fs.existsSync(report.reportPath)) {
      res.status(404).json({ error: "REPORT_NOT_FOUND" });
      return;
    }
    res.download(report.reportPath, `${report.id}.pdf`);
  });

  return router;
}
