import { Router } from "express";
import { z } from "zod";
import { ReportService } from "../services/ReportService.js";
import { EtherscanApiError } from "../chain/EtherscanClient.js";
const traceRequestSchema = z.object({
    walletAddress: z
        .string()
        .trim()
        .regex(/^0x[a-fA-F0-9]{40}$/, "walletAddress must be a 42-character 0x address"),
    chain: z.string().trim().optional(),
    caseId: z.string().trim().optional(),
});
function fileName(result) {
    const ref = !result.caseId || result.caseId.trim() === "" ? result.id : result.caseId;
    const cleanRef = ref.replace(/[^A-Za-z0-9._-]/g, "_");
    return `attribution-${cleanRef}.pdf`;
}
export function createTraceRouter(orchestrationService) {
    const traceRouter = Router();
    const reportService = new ReportService();
    // POST /api/traces
    traceRouter.post("/", async (req, res) => {
        const parseResult = traceRequestSchema.safeParse(req.body);
        if (!parseResult.success) {
            res.status(400).json({ error: parseResult.error.errors[0]?.message || "Invalid input" });
            return;
        }
        try {
            const result = await orchestrationService.submit(parseResult.data);
            res.status(200).json(result);
        }
        catch (error) {
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
    traceRouter.get("/:id", (req, res) => {
        try {
            const result = orchestrationService.get(String(req.params.id));
            if (!result) {
                res.status(404).json({ error: "Trace not found" });
                return;
            }
            res.status(200).json(result);
        }
        catch (error) {
            console.error("[TraceController] Error fetching trace:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    });
    // GET /api/traces/:id/report
    traceRouter.get("/:id/report", async (req, res) => {
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
        }
        catch (error) {
            console.error("[TraceController] Error rendering report:", error);
            res.status(500).json({ error: "Could not render report" });
        }
    });
    return traceRouter;
}
