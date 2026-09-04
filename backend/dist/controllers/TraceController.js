import { Router } from "express";
import { z } from "zod";
import { ReportService } from "../services/ReportService.js";
import { EtherscanApiError } from "../chain/EtherscanClient.js";
import { TronGridApiError } from "../chain/TronGridClient.js";
import { describeAddressProblem, normalizeAddress } from "../util/address.js";
import { config } from "../config.js";
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
        if (problem)
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: problem });
    }),
    /**
     * "ethereum" | "tron" | "all"
     * Defaults to "all" so the frontend can submit without specifying a chain and always
     * get a multi-chain result. Pass a specific chain to scope to one network.
     */
    chain: z.string().trim().optional().default("all"),
    caseId: z.string().trim().optional(),
});
function fileName(result) {
    const ref = !result.caseId || result.caseId.trim() === "" ? result.id : result.caseId;
    const cleanRef = ref.replace(/[^A-Za-z0-9._-]/g, "_");
    return `attribution-${cleanRef}.pdf`;
}
function isApiError(error) {
    return ((error instanceof EtherscanApiError && (error.kind === "AUTH" || error.kind === "PRO_REQUIRED")) ||
        (error instanceof TronGridApiError && error.kind === "AUTH"));
}
export function createTraceRouter(orchestrationService) {
    const traceRouter = Router();
    const reportService = new ReportService();
    // GET /api/chains — returns the list of supported chains for the frontend chain picker
    traceRouter.get("/chains", (_req, res) => {
        res.status(200).json(config.supportedChains);
    });
    // GET /api/traces — list recent traces (for the history / dashboard panel)
    traceRouter.get("/", (req, res) => {
        try {
            const limit = Math.min(parseInt(String(req.query.limit || "50"), 10) || 50, 200);
            const offset = parseInt(String(req.query.offset || "0"), 10) || 0;
            const traces = orchestrationService.list(limit, offset);
            res.status(200).json(traces);
        }
        catch (error) {
            console.error("[TraceController] Error listing traces:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    });
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
            if (isApiError(error)) {
                const msg = error instanceof Error ? error.message : String(error);
                console.error(`[TraceController] API configuration problem: ${msg}`);
                res.status(502).json({ error: msg });
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
