import { Router, Request, Response } from "express";
import { z } from "zod";
import { TraceOrchestrationService } from "../services/TraceOrchestrationService.js";
import { ReportService } from "../services/ReportService.js";
import { EtherscanApiError } from "../chain/EtherscanClient.js";
import { describeAddressProblem, normalizeAddress } from "../util/address.js";

const traceRequestSchema = z.object({
  // Normalise first, then explain any remaining problem in the caller's terms: a pasted
  // address carrying an invisible character is valid to the eye, so "must be a 42-character
  // 0x address" is not an answer the user can act on.
  walletAddress: z
    .string({
      required_error: "Enter the wallet address you want to trace.",
      invalid_type_error: "walletAddress must be a string.",
    })
    .transform(normalizeAddress)
    .superRefine((value, ctx) => {
      const problem = describeAddressProblem(value);
      if (problem) ctx.addIssue({ code: z.ZodIssueCode.custom, message: problem });
    }),
  chain: z.string().trim().optional(),
  caseId: z.string().trim().optional(),
});

function fileName(result: { caseId?: string | null; id: string }): string {
  const ref = !result.caseId || result.caseId.trim() === "" ? result.id : result.caseId;
  const cleanRef = ref.replace(/[^A-Za-z0-9._-]/g, "_");
  return `attribution-${cleanRef}.pdf`;
}

export function createTraceRouter(orchestrationService: TraceOrchestrationService): Router {
  const traceRouter = Router();
  const reportService = new ReportService();

  // POST /api/traces
  traceRouter.post("/", async (req: Request, res: Response) => {
    const parseResult = traceRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ error: parseResult.error.errors[0]?.message || "Invalid input" });
      return;
    }

    try {
      const result = await orchestrationService.submit(parseResult.data);
      res.status(200).json(result);
    } catch (error: unknown) {
      // A bad or unentitled Etherscan key is a server configuration problem; say so
      // instead of returning a generic 500 that looks like a bug in the trace.
      if (error instanceof EtherscanApiError && (error.kind === "AUTH" || error.kind === "PRO_REQUIRED")) {
        console.error(`[TraceController] Etherscan configuration problem: ${error.message}`);
        res.status(502).json({ error: error.message });
        return;
      }
      console.error("[TraceController] Error submitting trace:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // GET /api/traces/:id
  traceRouter.get("/:id", (req: Request, res: Response) => {
    try {
      const result = orchestrationService.get(String(req.params.id));
      if (!result) {
        res.status(404).json({ error: "Trace not found" });
        return;
      }
      res.status(200).json(result);
    } catch (error: unknown) {
      console.error("[TraceController] Error fetching trace:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // GET /api/traces/:id/report
  traceRouter.get("/:id/report", async (req: Request, res: Response) => {
    try {
      const result = orchestrationService.get(String(req.params.id));
      if (!result) {
        res.status(404).json({ error: "Trace not found" });
        return;
      }

      const pdfBuffer = await reportService.render(result);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${fileName(result)}"`);
      res.send(pdfBuffer);
    } catch (error: unknown) {
      console.error("[TraceController] Error rendering report:", error);
      res.status(500).json({ error: "Could not render report" });
    }
  });

  return traceRouter;
}
