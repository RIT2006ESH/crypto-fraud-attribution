import PDFDocument from "pdfkit";
import { TraceResultDto } from "../types/index.js";

const MAX_LEDGER_ROWS = 40;
/** Ledger column width caps the displayed precision; the exact value stays in the case record. */
const AMOUNT_DECIMALS = 6;
const DECIMAL_RE = /^(\d+)(?:\.(\d+))?$/;
const DUST_AMOUNT = `<0.${"0".repeat(AMOUNT_DECIMALS - 1)}1`;

export class ReportService {
  public async render(r: TraceResultDto): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: "A4",
          margin: 48,
        });

        const buffers: Buffer[] = [];
        doc.on("data", (chunk) => buffers.push(chunk));
        doc.on("end", () => resolve(Buffer.concat(buffers)));
        doc.on("error", (err) => reject(err));

        // Header
        doc.font("Helvetica-Bold").fontSize(15).fillColor("#111827").text("CRYPTO FRAUD ATTRIBUTION REPORT");
        doc.moveDown(0.2);

        const nowStr = formatDate(new Date().toISOString());
        doc.font("Helvetica-Oblique").fontSize(8).fillColor("#6B7280").text(`Generated ${nowStr} IST`);
        doc.moveDown(1);

        // Metadata Table
        const metaFields = [
          ["Case reference", r.caseId || "—"],
          ["Trace identifier", r.id || "—"],
          ["Chain", r.chain || "—"],
          ["Reported wallet", r.walletAddress || "—"],
          ["Trace status", r.status || "—"],
          ["Hops traced", (r.hopsTraced ?? 0).toString()],
          ["Addresses mapped", (r.nodes?.length || 0).toString()],
          ["Transfers recorded", (r.edges?.length || 0).toString()],
        ];

        let startY = doc.y;
        metaFields.forEach(([key, val]) => {
          doc.font("Helvetica").fontSize(10).fillColor("#374151").text(key, 48, startY, { width: 140 });
          const isWallet = key.includes("wallet");
          doc
            .font(isWallet ? "Courier" : "Helvetica")
            .fontSize(isWallet ? 9 : 10)
            .fillColor("#111827")
            .text(val, 190, startY, { width: 350 });
          startY += 18;
        });

        doc.y = startY + 10;

        // Section 1: Attribution finding
        heading(doc, "1. Attribution finding");

        if (r.nearestExchange) {
          const ex = r.nearestExchange;
          const entityName = ex.entity || "Unnamed exchange";
          const hopText = ex.hopDepth === 1 ? "1 hop" : `${ex.hopDepth} hops`;
          doc
            .font("Helvetica")
            .fontSize(10)
            .fillColor("#111827")
            .text(`${entityName} receives deposits ${hopText} from the reported wallet.`);
          doc.moveDown(0.2);
          doc.font("Courier").fontSize(9).fillColor("#4B5563").text(ex.address);
          doc.moveDown(0.4);
          doc
            .font("Helvetica")
            .fontSize(10)
            .fillColor("#374151")
            .text(
              "Recommended action: serve a disclosure request on this exchange for the account controlling the above deposit address."
            );
        } else {
          const hopsText = (r.hopsTraced ?? 0).toString();
          doc
            .font("Helvetica")
            .fontSize(10)
            .fillColor("#374151")
            .text(
              `No exchange or regulated service was reached within ${hopsText} hops. Funds remain in unlabelled wallets, or exited through a service absent from the current label set.`
            );
        }
        doc.moveDown(1);

        // Section 2: Risk assessment
        heading(doc, "2. Risk assessment");

        if (r.riskScore !== undefined && r.riskScore !== null) {
          doc
            .font("Helvetica-Bold")
            .fontSize(10)
            .fillColor("#111827")
            .text(`Score ${r.riskScore} of 100 — ${r.riskCategory || "—"}`);
          doc.moveDown(0.3);

          if (r.flaggedPatterns) {
            const patterns = r.flaggedPatterns.split("|");
            for (const p of patterns) {
              const trimmed = p.trim();
              if (trimmed) {
                doc.font("Helvetica").fontSize(10).fillColor("#374151").text(`•  ${trimmed}`);
              }
            }
          }
        } else {
          doc.font("Helvetica").fontSize(10).fillColor("#374151").text("Not scored; the trace did not complete.");
        }

        if (r.failureReason) {
          doc.moveDown(0.3);
          doc.font("Helvetica").fontSize(10).fillColor("#DC2626").text(`Failure reason: ${r.failureReason}`);
        }
        doc.moveDown(1);

        // Section 3: Transfer ledger
        heading(doc, "3. Transfer ledger");

        // Draw Ledger Table Headers
        const tableCols = [
          { label: "From", x: 48, width: 140, font: "Courier" },
          { label: "To", x: 190, width: 140, font: "Courier" },
          { label: "Amount (ETH)", x: 330, width: 90, font: "Courier" },
          { label: "Timestamp", x: 430, width: 110, font: "Helvetica" },
        ];

        let tableY = doc.y;

        doc.font("Helvetica-Bold").fontSize(10).fillColor("#111827");
        tableCols.forEach((col) => {
          doc.text(col.label, col.x, tableY, { width: col.width });
        });

        tableY += 16;
        doc.moveTo(48, tableY).lineTo(540, tableY).strokeColor("#E5E7EB").stroke();
        tableY += 6;

        const edgesToDisplay = (r.edges || []).slice(0, MAX_LEDGER_ROWS);
        edgesToDisplay.forEach((e) => {
          if (tableY > 750) {
            doc.addPage();
            tableY = 48;
          }

          doc.font("Courier").fontSize(9).fillColor("#374151").text(shorten(e.fromAddress), 48, tableY, { width: 140 });
          doc.font("Courier").fontSize(9).fillColor("#374151").text(shorten(e.toAddress), 190, tableY, { width: 140 });
          doc.font("Courier").fontSize(9).fillColor("#374151").text(formatAmount(e.amount), 330, tableY, { width: 90 });
          doc
            .font("Helvetica")
            .fontSize(9)
            .fillColor("#374151")
            .text(e.txTimestamp ? formatDate(e.txTimestamp) : "—", 430, tableY, { width: 110 });

          tableY += 16;
        });

        if ((r.edges || []).length > MAX_LEDGER_ROWS) {
          doc.moveDown(0.5);
          doc
            .font("Helvetica-Oblique")
            .fontSize(8)
            .fillColor("#6B7280")
            .text(
              `Showing the first ${MAX_LEDGER_ROWS} of ${r.edges.length} transfers. Full set available via the case record.`
            );
        }

        // Footer
        doc.moveDown(1.5);
        doc
          .font("Helvetica-Oblique")
          .fontSize(8)
          .fillColor("#9CA3AF")
          .text(
            "On-chain data sourced from Etherscan. Address attributions are derived from public label sets and heuristics; verify each label independently before relying on this report as evidence. Generated by CaseTrace."
          );

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

/**
 * Formats an ETH amount for the ledger column.
 *
 * `amount` arrives as an exact wei-derived decimal string (see weiToEth), so it is trimmed
 * as text: parseFloat/toFixed rounds values such as 0.005000361867 and loses precision on
 * large magnitudes.
 */
function formatAmount(val?: string | number | null): string {
  if (val === null || val === undefined) return "0";
  const raw = typeof val === "number" ? (Number.isFinite(val) ? val.toFixed(18) : "0") : val.trim();
  const parts = DECIMAL_RE.exec(raw);
  // Unexpected shape: show it verbatim rather than a misleading "0".
  if (!parts) return raw || "0";

  const whole = parts[1].replace(/^0+(?=\d)/, "");
  const fraction = parts[2] ?? "";
  const shown = fraction.slice(0, AMOUNT_DECIMALS).replace(/0+$/, "");
  if (shown) return `${whole}.${shown}`;
  // Nonzero but under the displayed precision. A dust transfer must not read as "0"
  // in an evidence ledger.
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
