package com.cryptofraud.attribution.service;

import com.cryptofraud.attribution.dto.TraceResultDto;
import com.lowagie.text.Document;
import com.lowagie.text.Element;
import com.lowagie.text.Font;
import com.lowagie.text.FontFactory;
import com.lowagie.text.PageSize;
import com.lowagie.text.Paragraph;
import com.lowagie.text.Phrase;
import com.lowagie.text.pdf.PdfPCell;
import com.lowagie.text.pdf.PdfPTable;
import com.lowagie.text.pdf.PdfWriter;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;

@Service
public class ReportService {

    private static final int MAX_LEDGER_ROWS = 40;
    private static final DateTimeFormatter STAMP =
            DateTimeFormatter.ofPattern("dd MMM yyyy, HH:mm").withZone(ZoneId.of("Asia/Kolkata"));

    private static final Font H1 = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 15);
    private static final Font H2 = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 11);
    private static final Font BODY = FontFactory.getFont(FontFactory.HELVETICA, 10);
    private static final Font BOLD = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 10);
    private static final Font MONO = FontFactory.getFont(FontFactory.COURIER, 9);
    private static final Font SMALL = FontFactory.getFont(FontFactory.HELVETICA_OBLIQUE, 8);

    public byte[] render(TraceResultDto r) {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        Document doc = new Document(PageSize.A4, 48, 48, 48, 54);
        try {
            PdfWriter.getInstance(doc, out);
            doc.open();

            doc.add(new Paragraph("CRYPTO FRAUD ATTRIBUTION REPORT", H1));
            Paragraph sub = new Paragraph(
                    "Generated " + STAMP.format(Instant.now()) + " IST", SMALL);
            sub.setSpacingAfter(14f);
            doc.add(sub);

            PdfPTable meta = new PdfPTable(new float[]{1.1f, 2.9f});
            meta.setWidthPercentage(100);
            meta.setSpacingAfter(16f);
            kv(meta, "Case reference", blank(r.caseId()));
            kv(meta, "Trace identifier", blank(r.id()));
            kv(meta, "Chain", blank(r.chain()));
            kv(meta, "Reported wallet", blank(r.walletAddress()));
            kv(meta, "Trace status", blank(r.status()));
            kv(meta, "Hops traced", r.hopsTraced() == null ? "0" : r.hopsTraced().toString());
            kv(meta, "Addresses mapped", String.valueOf(r.nodes().size()));
            kv(meta, "Transfers recorded", String.valueOf(r.edges().size()));
            doc.add(meta);

            doc.add(heading("1. Attribution finding"));
            if (r.nearestExchange() != null) {
                TraceResultDto.ExchangeDto ex = r.nearestExchange();
                doc.add(new Paragraph(
                        (ex.entity() == null ? "Unnamed exchange" : ex.entity())
                                + " receives deposits " + ex.hopDepth()
                                + (ex.hopDepth() == 1 ? " hop" : " hops")
                                + " from the reported wallet.", BODY));
                doc.add(new Paragraph(ex.address(), MONO));
                Paragraph act = new Paragraph(
                        "Recommended action: serve a disclosure request on this exchange for the "
                                + "account controlling the above deposit address.", BODY);
                act.setSpacingBefore(6f);
                act.setSpacingAfter(14f);
                doc.add(act);
            } else {
                Paragraph none = new Paragraph(
                        "No exchange or regulated service was reached within "
                                + (r.hopsTraced() == null ? 0 : r.hopsTraced())
                                + " hops. Funds remain in unlabelled wallets, or exited through a "
                                + "service absent from the current label set.", BODY);
                none.setSpacingAfter(14f);
                doc.add(none);
            }

            doc.add(heading("2. Risk assessment"));
            if (r.riskScore() != null) {
                doc.add(new Paragraph(
                        "Score " + r.riskScore() + " of 100 \u2014 " + blank(r.riskCategory()), BOLD));
                String patterns = r.flaggedPatterns();
                if (patterns != null && !patterns.isBlank()) {
                    for (String p : patterns.split("\\|")) {
                        if (!p.trim().isEmpty()) doc.add(new Paragraph("\u2022  " + p.trim(), BODY));
                    }
                }
            } else {
                doc.add(new Paragraph("Not scored; the trace did not complete.", BODY));
            }
            if (r.failureReason() != null) {
                doc.add(new Paragraph("Failure reason: " + r.failureReason(), BODY));
            }

            doc.add(heading("3. Transfer ledger"));
            PdfPTable ledger = new PdfPTable(new float[]{2.2f, 2.2f, 1.2f, 1.6f});
            ledger.setWidthPercentage(100);
            ledger.setHeaderRows(1);
            for (String h : new String[]{"From", "To", "Amount (ETH)", "Timestamp"}) {
                PdfPCell cell = new PdfPCell(new Phrase(h, BOLD));
                cell.setPadding(4f);
                ledger.addCell(cell);
            }
            r.edges().stream().limit(MAX_LEDGER_ROWS).forEach(e -> {
                ledger.addCell(cell(shorten(e.fromAddress()), MONO));
                ledger.addCell(cell(shorten(e.toAddress()), MONO));
                ledger.addCell(cell(amount(e.amount()), MONO));
                ledger.addCell(cell(e.txTimestamp() == null ? "\u2014" : STAMP.format(e.txTimestamp()), BODY));
            });
            doc.add(ledger);

            if (r.edges().size() > MAX_LEDGER_ROWS) {
                doc.add(new Paragraph("Showing the first " + MAX_LEDGER_ROWS + " of "
                        + r.edges().size() + " transfers. Full set available via the case record.", SMALL));
            }

            Paragraph foot = new Paragraph(
                    "On-chain data sourced from Etherscan. Address attributions are derived from public "
                            + "label sets and heuristics; verify each label independently before relying on "
                            + "this report as evidence. Generated by CaseTrace.", SMALL);
            foot.setSpacingBefore(20f);
            doc.add(foot);

            doc.close();
        } catch (Exception e) {
            throw new IllegalStateException("Could not render the report: " + e.getMessage(), e);
        }
        return out.toByteArray();
    }

    private static Paragraph heading(String text) {
        Paragraph p = new Paragraph(text, H2);
        p.setSpacingBefore(10f);
        p.setSpacingAfter(7f);
        return p;
    }

    private static void kv(PdfPTable table, String key, String value) {
        table.addCell(cell(key, BODY));
        table.addCell(cell(value, key.contains("wallet") ? MONO : BODY));
    }

    private static PdfPCell cell(String text, Font font) {
        PdfPCell cell = new PdfPCell(new Phrase(text, font));
        cell.setPadding(4f);
        cell.setBorder(PdfPCell.BOTTOM);
        cell.setHorizontalAlignment(Element.ALIGN_LEFT);
        return cell;
    }

    private static String blank(String s) {
        return s == null || s.isBlank() ? "\u2014" : s;
    }

    private static String shorten(String addr) {
        return addr == null || addr.length() <= 18 ? blank(addr)
                : addr.substring(0, 10) + "\u2026" + addr.substring(addr.length() - 6);
    }

    private static String amount(BigDecimal v) {
        return v == null ? "0"
                : v.setScale(6, RoundingMode.HALF_UP).stripTrailingZeros().toPlainString();
    }
}
