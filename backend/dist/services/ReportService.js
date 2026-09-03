import PDFDocument from "pdfkit";
const MAX_LEDGER_ROWS = 40;
export class ReportService {
    async render(r) {
        return new Promise((resolve, reject) => {
            try {
                const doc = new PDFDocument({
                    size: "A4",
                    margin: 48,
                });
                const buffers = [];
                doc.on("data", (chunk) => buffers.push(chunk));
                doc.on("end", () => resolve(Buffer.concat(buffers)));
                doc.on("error", (err) => reject(err));
                // 1. Cover Page & Header
                doc.font("Helvetica-Bold").fontSize(18).fillColor("#05070B").text("CASETRACE FORENSIC REPORT");
                doc.moveDown(0.2);
                doc.font("Helvetica-Bold").fontSize(12).fillColor("#3B82F6").text("Crypto Fraud Attribution Platform");
                doc.moveDown(0.5);
                const nowStr = formatDate(new Date().toISOString());
                doc.font("Helvetica-Oblique").fontSize(8).fillColor("#6B7280").text(`Generated: ${nowStr} | Confidential`);
                doc.moveDown(1);
                doc.moveTo(48, doc.y).lineTo(540, doc.y).strokeColor("#E5E7EB").stroke();
                doc.moveDown(1);
                // Metadata Block
                const metaFields = [
                    ["Case Reference ID", r.caseId || "—"],
                    ["Trace Identifier", r.id || "—"],
                    ["Chain Network", r.chain || "—"],
                    ["Target Wallet Address", r.walletAddress || "—"],
                    ["Trace Execution Status", r.status || "—"],
                    ["Hops Traced Depth", (r.hopsTraced ?? 0).toString()],
                    ["Addresses Discovered", (r.nodes?.length || 0).toString()],
                    ["Transfers Recorded", (r.edges?.length || 0).toString()],
                ];
                let startY = doc.y;
                metaFields.forEach(([key, val]) => {
                    doc.font("Helvetica-Bold").fontSize(9).fillColor("#374151").text(key, 48, startY, { width: 150 });
                    const isWallet = key.includes("Wallet") || key.includes("Identifier");
                    doc
                        .font(isWallet ? "Courier" : "Helvetica")
                        .fontSize(9)
                        .fillColor("#111827")
                        .text(val, 200, startY, { width: 340 });
                    startY += 16;
                });
                doc.y = startY + 12;
                // 2. Executive Summary
                heading(doc, "Executive Summary");
                const score = r.riskScore ?? 0;
                const category = r.riskCategory || "LOW";
                doc
                    .font("Helvetica-Bold")
                    .fontSize(11)
                    .fillColor("#111827")
                    .text(`Risk Score: ${score} / 100 — Assessment Level: ${category}`);
                doc.moveDown(0.4);
                if (r.nearestExchange) {
                    const ex = r.nearestExchange;
                    const entityName = ex.entity || "Regulated Service";
                    const hopText = ex.hopDepth === 1 ? "1 hop" : `${ex.hopDepth} hops`;
                    doc
                        .font("Helvetica")
                        .fontSize(10)
                        .fillColor("#111827")
                        .text(`Attribution Finding: ${entityName} receives deposits ${hopText} away from target wallet.`);
                    doc.moveDown(0.2);
                    doc.font("Courier").fontSize(9).fillColor("#4B5563").text(`Deposit Address: ${ex.address}`);
                    doc.moveDown(0.4);
                    doc
                        .font("Helvetica")
                        .fontSize(9)
                        .fillColor("#374151")
                        .text("Recommended Legal Action: Issue disclosure request/subpoena on this entity to obtain KYC records.");
                }
                else {
                    const hopsText = (r.hopsTraced ?? 0).toString();
                    doc
                        .font("Helvetica")
                        .fontSize(10)
                        .fillColor("#374151")
                        .text(`No regulated exchange was reached within ${hopsText} hops. Funds remain in unlabelled addresses or exited via unindexed pools.`);
                }
                doc.moveDown(1);
                // 3. Risk Findings
                heading(doc, "Risk Findings & Indicators");
                if (r.flaggedPatterns) {
                    const patterns = r.flaggedPatterns.split("|");
                    for (const p of patterns) {
                        const trimmed = p.trim();
                        if (trimmed) {
                            doc.font("Helvetica").fontSize(9).fillColor("#374151").text(`•  ${trimmed}`);
                        }
                    }
                }
                else {
                    doc.font("Helvetica").fontSize(9).fillColor("#374151").text("No high-risk patterns detected.");
                }
                doc.moveDown(1);
                // 4. Transaction Timeline & Ledger Table
                heading(doc, "Transaction Ledger (Top Transfers)");
                const tableCols = [
                    { label: "From", x: 48, width: 140 },
                    { label: "To", x: 190, width: 140 },
                    { label: "Amount (ETH)", x: 330, width: 90 },
                    { label: "Timestamp", x: 430, width: 110 },
                ];
                let tableY = doc.y;
                doc.font("Helvetica-Bold").fontSize(9).fillColor("#111827");
                tableCols.forEach((col) => {
                    doc.text(col.label, col.x, tableY, { width: col.width });
                });
                tableY += 14;
                doc.moveTo(48, tableY).lineTo(540, tableY).strokeColor("#E5E7EB").stroke();
                tableY += 6;
                const edgesToDisplay = (r.edges || []).slice(0, MAX_LEDGER_ROWS);
                edgesToDisplay.forEach((e) => {
                    if (tableY > 750) {
                        doc.addPage();
                        tableY = 48;
                    }
                    const fromAddr = e.fromAddress || e.from || "—";
                    const toAddr = e.toAddress || e.to || "—";
                    const ts = e.txTimestamp || e.timestamp || null;
                    doc.font("Courier").fontSize(8).fillColor("#374151").text(shorten(fromAddr), 48, tableY, { width: 140 });
                    doc.font("Courier").fontSize(8).fillColor("#374151").text(shorten(toAddr), 190, tableY, { width: 140 });
                    doc.font("Courier").fontSize(8).fillColor("#374151").text(formatAmount(e.amount), 330, tableY, { width: 90 });
                    doc
                        .font("Helvetica")
                        .fontSize(8)
                        .fillColor("#374151")
                        .text(ts ? formatDate(ts) : "—", 430, tableY, { width: 110 });
                    tableY += 14;
                });
                if ((r.edges || []).length > MAX_LEDGER_ROWS) {
                    doc.moveDown(0.5);
                    doc
                        .font("Helvetica-Oblique")
                        .fontSize(8)
                        .fillColor("#6B7280")
                        .text(`Showing first ${MAX_LEDGER_ROWS} of ${r.edges.length} transfers. Full set available via investigation case record.`);
                }
                // 5. Evidence Footer
                doc.moveDown(1.5);
                doc.moveTo(48, doc.y).lineTo(540, doc.y).strokeColor("#E5E7EB").stroke();
                doc.moveDown(0.5);
                doc
                    .font("Helvetica-Oblique")
                    .fontSize(8)
                    .fillColor("#9CA3AF")
                    .text(`Report Hash: ${r.id} | Generated by CaseTrace Forensic Engine | On-chain data sourced from Etherscan V2 API.`);
                doc.end();
            }
            catch (err) {
                reject(err);
            }
        });
    }
}
function heading(doc, text) {
    doc.font("Helvetica-Bold").fontSize(11).fillColor("#111827").text(text);
    doc.moveDown(0.4);
}
function shorten(addr) {
    if (!addr)
        return "—";
    if (addr.length <= 18)
        return addr;
    return `${addr.substring(0, 10)}…${addr.substring(addr.length - 6)}`;
}
function formatAmount(val) {
    if (val === null || val === undefined)
        return "0";
    const num = typeof val === "number" ? val : parseFloat(val);
    if (isNaN(num))
        return "0";
    return num.toFixed(6).replace(/\.?0+$/, "");
}
function formatDate(isoStr) {
    if (!isoStr)
        return "—";
    try {
        const d = new Date(isoStr);
        const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const day = d.getDate().toString().padStart(2, "0");
        const month = months[d.getMonth()];
        const year = d.getFullYear();
        const hours = d.getHours().toString().padStart(2, "0");
        const mins = d.getMinutes().toString().padStart(2, "0");
        return `${day} ${month} ${year}, ${hours}:${mins}`;
    }
    catch {
        return isoStr;
    }
}
