import { Router, Request, Response } from "express";
import { z } from "zod";
import { TraceOrchestrationService } from "../services/TraceOrchestrationService.js";
import { ReportService } from "../services/ReportService.js";

export const traceRouter = Router();
const orchestrationService = new TraceOrchestrationService();
const reportService = new ReportService();

const traceRequestSchema = z.object({
  walletAddress: z.string().min(1, "walletAddress is required"),
  chain: z.string().optional(),
  caseId: z.string().optional(),
});

// POST /api/traces
traceRouter.post("/", async (req: Request, res: Response) => {
  try {
    const parseResult = traceRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ error: parseResult.error.errors[0]?.message || "Invalid input" });
      return;
    }

    const result = await orchestrationService.submit(parseResult.data);
    res.status(200).json(result);
  } catch (error: any) {
    console.error("[TraceController] Error submitting trace:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/traces/:id
traceRouter.get("/:id", (req: Request, res: Response) => {
  try {
    const id = (Array.isArray(req.params.id) ? req.params.id[0] : req.params.id) as string;
    const result = orchestrationService.get(id);
    if (!result) {
      res.status(404).json({ error: "Trace not found" });
      return;
    }
    res.status(200).json(result);
  } catch (error: any) {
    console.error("[TraceController] Error fetching trace:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/traces/:id/report
traceRouter.get("/:id/report", async (req: Request, res: Response) => {
  try {
    const id = (Array.isArray(req.params.id) ? req.params.id[0] : req.params.id) as string;
    const result = orchestrationService.get(id);
    if (!result) {
      res.status(404).json({ error: "Trace not found" });
      return;
    }

    const filename = fileName(result);
    const pdfBuffer = await reportService.render(result);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(pdfBuffer);
  } catch (error: any) {
    console.error("[TraceController] Error rendering report:", error);
    res.status(500).json({ error: "Could not render report" });
  }
});

function fileName(result: any): string {
  const ref = !result.caseId || result.caseId.trim() === "" ? result.id : result.caseId;
  const cleanRef = ref.replace(/[^A-Za-z0-9._-]/g, "_");
  return `attribution-${cleanRef}.pdf`;
}
