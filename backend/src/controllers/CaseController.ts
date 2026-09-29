import { Router, Request, Response } from "express";
import { z } from "zod";
import { caseRepository, traceRequestRepository } from "../db/database.js";

const createCaseSchema = z.object({
  caseReference: z.string().trim().min(1),
  title: z.string().trim().optional(),
});

const updateCaseSchema = z.object({
  status: z.enum(["OPEN", "CLOSED"]).optional(),
  title: z.string().trim().optional(),
  riskLevel: z.string().trim().optional(),
  riskScore: z.number().optional(),
});

export function createCaseRouter(): Router {
  const router = Router();

  router.post("/", (req: Request, res: Response) => {
    try {
      const parsed = createCaseSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors[0]?.message || "Invalid input" });
      }
      
      const existing = caseRepository.findByReference(parsed.data.caseReference);
      if (existing) {
        return res.status(409).json({ error: "Case reference already exists" });
      }

      const c = caseRepository.save({
        caseReference: parsed.data.caseReference,
        title: parsed.data.title,
        status: "OPEN"
      });
      res.status(201).json(c);
    } catch (err: any) {
      console.error("[CaseController] Create case failed:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  router.get("/", (_req: Request, res: Response) => {
    try {
      const cases = caseRepository.findAll();
      res.status(200).json(cases);
    } catch (err: any) {
      console.error("[CaseController] List cases failed:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  router.get("/:id", (req: Request, res: Response) => {
    try {
      const c = caseRepository.findById(String(req.params.id));
      if (!c) {
        return res.status(404).json({ error: "Case not found" });
      }
      res.status(200).json(c);
    } catch (err: any) {
      console.error("[CaseController] Get case failed:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  router.patch("/:id", (req: Request, res: Response) => {
    try {
      const parsed = updateCaseSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors[0]?.message || "Invalid input" });
      }

      const c = caseRepository.findById(String(req.params.id));
      if (!c) {
        return res.status(404).json({ error: "Case not found" });
      }

      const updated = caseRepository.save({
        ...c,
        status: parsed.data.status ?? c.status,
        title: parsed.data.title ?? c.title,
        riskLevel: parsed.data.riskLevel ?? c.riskLevel,
        riskScore: parsed.data.riskScore ?? c.riskScore,
      });
      res.status(200).json(updated);
    } catch (err: any) {
      console.error("[CaseController] Update case failed:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  router.get("/:id/investigations", (req: Request, res: Response) => {
    try {
      const cases = traceRequestRepository.findAll().filter(r => r.caseId === String(req.params.id));
      res.status(200).json(cases);
    } catch (err: any) {
      console.error("[CaseController] Get case investigations failed:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  return router;
}
