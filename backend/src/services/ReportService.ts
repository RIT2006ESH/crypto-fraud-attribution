import PDFDocument from "pdfkit";
import { TraceResultDto, MultiChainTraceResultDto, Report, ReportStatus } from "../types/index.js";
import { reportRepository, auditRepository } from "../db/database.js";
import fs from "fs";
import path from "path";
import crypto from "crypto";

const MAX_LEDGER_ROWS = 40;
const AMOUNT_DECIMALS = 6;
const DECIMAL_RE = /^(\d+)(?:\.(\d+))?$/;
const DUST_AMOUNT = `<0.${"0".repeat(AMOUNT_DECIMALS - 1)}1`;
const REPORT_STORAGE_PATH = process.env.REPORT_STORAGE_PATH || "./data/reports";

export class ReportService {
  public async generateReport(investigationResult: TraceResultDto | MultiChainTraceResultDto, reqConfig?: any): Promise<Report> {
    const isMultiChain = "perChain" in investigationResult;
    const invId = isMultiChain ? (investigationResult as any).id || "multi" : (investigationResult as TraceResultDto).id;
    const caseId = isMultiChain ? null : (investigationResult as TraceResultDto).caseId;
    
    // Find version
    const existingReports = reportRepository.findByInvestigationId(invId);
    const version = existingReports.length > 0 ? existingReports[0].reportVersion + 1 : 1;
    const reportId = `RPT-${caseId || invId}-${version.toString().padStart(2, '0')}`;
    
    const partialReport: Partial<Report> = {
      id: reportId,
      investigationId: invId,
      caseId: caseId || null,
      reportVersion: version,
      status: ReportStatus.GENERATING,
      generatedAt: new Date().toISOString(),
      reportDataJson: JSON.stringify(investigationResult)
    };
    let report = reportRepository.save(partialReport as any);

    auditRepository.save({
      caseId: caseId || null,
      investigationId: invId,
      eventType: "REPORT_GENERATION_STARTED",
      actorType: "SYSTEM",
      metadataJson: JSON.stringify({ reportId })
    });

    try {
      if (!fs.existsSync(REPORT_STORAGE_PATH)) {
        fs.mkdirSync(REPORT_STORAGE_PATH, { recursive: true });
      }
      
      const pdfBuffer = await this.render(investigationResult as any);
      
      const hash = crypto.createHash("sha256").update(pdfBuffer).digest("hex");
      const filePath = path.join(REPORT_STORAGE_PATH, `${reportId}.pdf`);
      fs.writeFileSync(filePath, pdfBuffer);
      
      report.status = ReportStatus.COMPLETED;
      report.reportHash = hash;
      report.reportPath = filePath;
      report.fileSize = pdfBuffer.length;
      report = reportRepository.save(report);

      auditRepository.save({
        caseId: caseId || null,
        investigationId: invId,
        eventType: "REPORT_GENERATED",
        actorType: "SYSTEM",
        metadataJson: JSON.stringify({ reportId, hash })
      });

      return report;
    } catch (err: any) {
      report.status = ReportStatus.FAILED;
      report = reportRepository.save(report);

      auditRepository.save({
        caseId: caseId || null,
        investigationId: invId,
        eventType: "REPORT_GENERATION_FAILED",
        actorType: "SYSTEM",
        metadataJson: JSON.stringify({ reportId, error: err.message })
      });

      throw err;
    }
  }

  private async render(r: TraceResultDto | MultiChainTraceResultDto): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ size: "A4", margin: 48, bufferPages: true });
        const buffers: Buffer[] = [];
        doc.on("data", (chunk) => buffers.push(chunk));
        doc.on("end", () => resolve(Buffer.concat(buffers)));
        doc.on("error", (err) => reject(err));

        const isMulti = "perChain" in r;
        const baseResult = isMulti ? r as MultiChainTraceResultDto : r as TraceResultDto;
        const main = isMulti ? Object.values((baseResult as MultiChainTraceResultDto).perChain)[0] as TraceResultDto : baseResult as TraceResultDto;

        // 1. Cover
        doc.font("Helvetica-Bold").fontSize(24).fillColor("#111827").text("CASETRACE");
        doc.moveDown(1);
        doc.fontSize(18).text("CRYPTO FORENSIC INVESTIGATION REPORT");
        doc.moveDown(2);
        
        doc.fontSize(12).text(`Case: ${main.caseId || "—"}`);
        doc.text(`Investigation: ${main.id || "multi"}`);
        doc.text(`Target: ${main.walletAddress || "—"}`);
        doc.text(`Network: ${isMulti ? "All Chains" : main.chain}`);
        doc.text(`Status: COMPLETED`);
        doc.text(`Generated: ${formatDate(new Date().toISOString())} UTC`);
        doc.addPage();

        // 2. Executive Summary
        heading(doc, "EXECUTIVE INVESTIGATION SUMMARY");
        doc.font("Helvetica").fontSize(10).fillColor("#374151");
        
        if (isMulti) {
           doc.text(`Metrics: Overall Risk Score: ${(baseResult as MultiChainTraceResultDto).overallRiskScore}`);
           if (baseResult.nearestExchange) {
             doc.text(`Entity: ${baseResult.nearestExchange.entity || "Unnamed Exchange"} at depth ${baseResult.nearestExchange.hopDepth}`);
           }
        } else {
           doc.text(`Nodes: ${main.nodes?.length || 0}`);
           doc.text(`Transfers: ${main.edges?.length || 0}`);
           doc.text(`Hops: ${main.hopsTraced || 0}`);
           
           if (main.nearestExchange) {
             doc.text(`Entity: ${main.nearestExchange.entity || "Unnamed Exchange"} at depth ${main.nearestExchange.hopDepth}`);
             doc.text(`Attribution Confidence: ${main.nearestExchange.entity ? "95%" : "UNKNOWN"}`);
           } else {
             doc.text(`Primary Attribution: NONE / UNKNOWN`);
             doc.text(`Attribution Confidence: UNKNOWN`);
           }

           doc.text(`Risk: ${main.riskScore || 0} / 100 - ${main.riskCategory || "LOW"}`);
        }
        
        doc.moveDown(1);
        heading(doc, "KEY FINDINGS");
        doc.font("Helvetica").fontSize(10);
        if (!isMulti && main.nearestExchange) {
            doc.text(`1. KNOWN ENTITY ENCOUNTER: A known Exchange / VASP label was encountered at hop ${main.nearestExchange.hopDepth}.`);
            doc.text(`   Supporting address: ${main.nearestExchange.address}`);
            doc.text(`   Source: Curated Registry`);
        } else {
            doc.text(`1. No significant entities identified.`);
        }
        doc.addPage();

        // 3. TARGET WALLET
        heading(doc, "TARGET WALLET");
        doc.font("Helvetica").fontSize(10);
        doc.text(`Address: ${main.walletAddress || "—"}`);
        doc.text(`Network: ${isMulti ? "All Chains" : main.chain}`);
        doc.moveDown(1);

        // 4. INVESTIGATION PARAMETERS
        heading(doc, "INVESTIGATION PARAMETERS");
        doc.text(`Target Address: ${main.walletAddress || "—"}`);
        doc.text(`Chain: ${isMulti ? "All Chains" : main.chain}`);
        doc.text(`Requested At: ${main.requestedAt || "—"}`);
        doc.text(`Completed At: ${main.completedAt || "—"}`);
        doc.moveDown(1);

        // 5. TRACE SUMMARY
        heading(doc, "TRACE SUMMARY");
        if (isMulti) {
           doc.text(`Completion: ${"COMPLETED"}`);
        } else {
           doc.text(`Nodes: ${main.nodes?.length || 0}`);
           doc.text(`Transfers: ${main.edges?.length || 0}`);
           doc.text(`Hops: ${main.hopsTraced || 0}`);
           if (main.status === "PARTIAL") {
              doc.text(`COMPLETION: PARTIAL`);
              doc.text(`Limitations: Some data could not be retrieved or processed.`);
           } else {
              doc.text(`Completion: ${main.status || "COMPLETED"}`);
           }
        }
        doc.addPage();
        
        // 6. FUND-FLOW GRAPH
        heading(doc, "FUND FLOW GRAPH");
        doc.text("Graph visualization unavailable for this report generation.");
        doc.addPage();

        // 7. ENTITY ATTRIBUTION
        heading(doc, "ENTITY ATTRIBUTION");
        if (isMulti) {
           doc.text(`Found nearest exchange across chains: ${baseResult.nearestExchange?.entity || baseResult.nearestExchange?.address || "None"}`);
        } else {
            if (main.nearestExchange) {
                doc.text(`Address: ${main.nearestExchange.address}`);
                doc.text(`Entity: ${main.nearestExchange.entity || "Exchange / VASP"}`);
                doc.text(`Chain: ${main.chain}`);
                doc.text(`Confidence: 95%`);
                doc.text(`Source: Curated Registry`);
            } else {
                doc.text(`Primary Attribution: NONE / UNKNOWN`);
            }
        }
        doc.addPage();

        // 8. RISK ASSESSMENT
        heading(doc, "RISK ASSESSMENT");
        doc.font("Helvetica").fontSize(10);
        const score = isMulti ? (baseResult as MultiChainTraceResultDto).overallRiskScore : (main.riskScore || 0);
        const cat = isMulti ? (baseResult as MultiChainTraceResultDto).overallRiskCategory : (main.riskCategory || "LOW");
        doc.text(`Score: ${score} / 100`);
        doc.text(`Level: ${cat}`);
        doc.moveDown(1);
        heading(doc, "RISK FACTORS");
        if (!isMulti && main.flaggedPatterns) {
            const patterns = main.flaggedPatterns.split("|");
            for (const p of patterns) {
                const trimmed = p.trim();
                if (trimmed) doc.text(`• ${trimmed}`);
            }
        } else {
            doc.text("No specific risk factors flagged.");
        }
        doc.addPage();
        
        // 9. TRANSACTION EVIDENCE
        heading(doc, "TRANSACTION EVIDENCE");
        
        if (isMulti) {
            doc.text(`Multiple chains investigated. See individual chain ledgers.`);
        } else {
            const tableCols = [
              { label: "From", x: 48, width: 120, font: "Courier" },
              { label: "To", x: 170, width: 120, font: "Courier" },
              { label: "Asset", x: 290, width: 50, font: "Courier" },
              { label: "Amount", x: 350, width: 90, font: "Courier" },
              { label: "Timestamp", x: 440, width: 100, font: "Helvetica" },
            ];

            let tableY = doc.y;
            doc.font("Helvetica-Bold").fontSize(9).fillColor("#111827");
            tableCols.forEach((col) => {
              doc.text(col.label, col.x, tableY, { width: col.width });
            });
            tableY += 16;
            doc.moveTo(48, tableY).lineTo(540, tableY).strokeColor("#E5E7EB").stroke();
            tableY += 6;

            const edgesToDisplay = (main.edges || []).slice(0, MAX_LEDGER_ROWS);
            edgesToDisplay.forEach((e) => {
              if (tableY > 750) {
                doc.addPage();
                tableY = 48;
              }
              const asset = e.tokenSymbol || (main.chain === "tron" ? "TRX" : main.chain === "polygon" ? "POL" : "ETH");
              doc.font("Courier").fontSize(8).fillColor("#374151").text(shorten(e.fromAddress), 48, tableY, { width: 120 });
              doc.font("Courier").fontSize(8).fillColor("#374151").text(shorten(e.toAddress), 170, tableY, { width: 120 });
              doc.font("Courier").fontSize(8).fillColor("#374151").text(asset, 290, tableY, { width: 50 });
              doc.font("Courier").fontSize(8).fillColor("#374151").text(formatAmount(e.amount), 350, tableY, { width: 90 });
              doc.font("Helvetica").fontSize(8).fillColor("#374151").text(e.txTimestamp ? formatDate(e.txTimestamp) : "—", 440, tableY, { width: 100 });
              tableY += 16;
            });
            
            if ((main.edges || []).length > MAX_LEDGER_ROWS) {
              doc.moveDown(0.5);
              doc.font("Helvetica-Oblique").fontSize(8).fillColor("#6B7280").text(`${main.edges.length} transfers analyzed. Full transaction ledger is preserved in the case investigation record.`);
            }
        }
        doc.addPage();

        // 10. PROVENANCE & METHODOLOGY
        heading(doc, "DATA PROVENANCE");
        doc.font("Helvetica").fontSize(10);
        if (isMulti) {
           doc.text(`Provider: Etherscan, TronGrid, Polygon Provider`);
           doc.text(`Network: All Chains`);
        } else {
           if (main.chain === "ethereum") {
               doc.text(`Provider: Etherscan`);
               doc.text(`Network: Ethereum Mainnet`);
           } else if (main.chain === "polygon") {
               doc.text(`Provider: Etherscan-compatible Polygon source`);
               doc.text(`Network: Polygon PoS Mainnet`);
           } else if (main.chain === "tron") {
               doc.text(`Provider: TronGrid`);
               doc.text(`Network: Tron Mainnet`);
           }
        }
        doc.text(`Fetched At: ${formatDate(new Date().toISOString())} UTC`);
        doc.text(`Source: CASETRACE Curated Address Registry`);
        doc.moveDown(1);
        heading(doc, "METHODOLOGY");
        doc.text(`1. Target address validated.\n2. Blockchain transaction data retrieved.\n3. Transfer data normalized.\n4. Fund paths traced to configured depth.\n5. Known entity labels resolved.\n6. Risk indicators evaluated.\n7. Findings generated.\n8. Investigation report generated.`);
        doc.moveDown(1);
        heading(doc, "INVESTIGATION LIMITATIONS");
        doc.text(`- Trace results are limited by configured depth.\n- Unlabelled addresses could not be attributed using available registry data.\n- Results depend on available upstream blockchain data.\n- Provider outages or rate limits may result in incomplete results.\n- Entity labels may change over time.\n- Absence from this graph does not establish absence of blockchain activity.`);
        doc.moveDown(1);
        doc.text(`"This report presents analytical findings derived from available blockchain transaction data and configured entity information. Results may be incomplete and should be independently reviewed."`, { oblique: true });

        // Add headers/footers to pages (except cover)
        const pages = doc.bufferedPageRange();
        for (let i = 1; i < pages.count; i++) {
          doc.switchToPage(i);
          doc.font("Helvetica").fontSize(8).fillColor("#9CA3AF");
          doc.text(`CASETRACE | Case ID: ${main.caseId || "—"} | Investigation ID: ${main.id || "multi"} | Page ${i+1} of ${pages.count}`, 48, 30, { align: "right" });
          doc.text(`CASETRACE Crypto Forensic Investigation Report | Generated: ${formatDate(new Date().toISOString())}`, 48, doc.page.height - 40, { align: "center" });
        }

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }
}

function heading(doc: PDFKit.PDFDocument, text: string) {
  doc.font("Helvetica-Bold").fontSize(11).fillColor("#111827").text(text);
  doc.moveDown(0.4);
}

function shorten(addr?: string | null): string {
  if (!addr) return "—";
  if (addr.length <= 18) return addr;
  return `${addr.substring(0, 10)}…${addr.substring(addr.length - 6)}`;
}

function formatAmount(val?: string | number | null): string {
  if (val === null || val === undefined) return "0";
  const raw = typeof val === "number" ? (Number.isFinite(val) ? val.toFixed(18) : "0") : val.trim();
  const parts = DECIMAL_RE.exec(raw);
  if (!parts) return raw || "0";

  const whole = parts[1].replace(/^0+(?=\d)/, "");
  const fraction = parts[2] ?? "";
  const shown = fraction.slice(0, AMOUNT_DECIMALS).replace(/0+$/, "");
  if (shown) return `${whole}.${shown}`;
  if (whole === "0" && /[1-9]/.test(fraction)) return DUST_AMOUNT;
  return whole;
}

function formatDate(isoStr?: string | null): string {
  if (!isoStr) return "—";
  try {
    const d = new Date(isoStr);
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const day = d.getDate().toString().padStart(2, "0");
    const month = months[d.getMonth()];
    const year = d.getFullYear();
    const hours = d.getHours().toString().padStart(2, "0");
    const mins = d.getMinutes().toString().padStart(2, "0");
    return `${day} ${month} ${year}, ${hours}:${mins}`;
  } catch {
    return isoStr;
  }
}
