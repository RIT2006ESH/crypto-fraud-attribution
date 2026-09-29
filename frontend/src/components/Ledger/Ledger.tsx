import { useState, useMemo } from "react";
import { Search, Copy, Check, Filter } from "lucide-react";
import type { TraceResult } from "../../types";
import { formatAmount, formatDate, shortenAddress, shortenHash, copyToClipboard } from "../../format";

interface Props {
  result: TraceResult;
  focus?: string | null;
  onClearFocus?: () => void;
}

/** Small colour-coded badge showing the token symbol. */
function TokenBadge({ symbol, transferType }: { symbol?: string | null; transferType?: string | null }) {
  const s = symbol || (transferType === "trc20" || transferType === "erc20" ? "TOKEN" : null);
  if (!s) return null;

  // Colour: stablecoins = green, native tokens = grey, others = blue
  let bg    = "rgba(59, 130, 246, 0.15)";
  let color = "#3b82f6";
  const upper = s.toUpperCase();
  if (["USDT", "USDC", "DAI", "BUSD"].includes(upper)) {
    bg    = "rgba(16, 185, 129, 0.15)";
    color = "#10b981";
  } else if (["ETH", "TRX", "BNB", "MATIC"].includes(upper)) {
    bg    = "rgba(148, 163, 184, 0.12)";
    color = "#94a3b8";
  }

  return (
    <span style={{
      display:       "inline-block",
      padding:       "1px 6px",
      borderRadius:  "4px",
      fontSize:      "10px",
      fontWeight:    700,
      letterSpacing: "0.3px",
      background:    bg,
      color,
      border:        `1px solid ${color}40`,
      fontFamily:    "var(--font-mono)",
    }}>
      {upper}
    </span>
  );
}

export default function Ledger({ result, focus, onClearFocus }: Props) {
  const [searchTerm, setSearchTerm]   = useState("");
  const [copiedId,   setCopiedId]     = useState<string | null>(null);

  const edges = result.edges || [];

  const handleCopy = async (text: string, id: string) => {
    const ok = await copyToClipboard(text);
    if (ok) {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1800);
    }
  };

  const filteredEdges = useMemo(() => {
    return edges.filter((e: any) => {
      const matchSearch =
        !searchTerm.trim() ||
        e.fromAddress.toLowerCase().includes(searchTerm.toLowerCase()) ||
        e.toAddress.toLowerCase().includes(searchTerm.toLowerCase()) ||
        e.txHash.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (e.tokenSymbol || "").toLowerCase().includes(searchTerm.toLowerCase());

      const matchFocus =
        !focus ||
        e.fromAddress.toLowerCase() === focus.toLowerCase() ||
        e.toAddress.toLowerCase() === focus.toLowerCase();

      return matchSearch && matchFocus;
    });
  }, [edges, searchTerm, focus]);

  return (
    <div className="ledger-panel">
      <div className="ledger-header">
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <h3 className="card-title" style={{ fontSize: "14px" }}>
            <Filter size={14} className="text-primary" />
            Transaction Ledger ({filteredEdges.length})
          </h3>
          {focus && (
            <button
              type="button"
              onClick={onClearFocus}
              style={{
                fontSize:     "11px",
                padding:      "2px 8px",
                borderRadius: "4px",
                background:   "rgba(6, 182, 212, 0.15)",
                color:        "var(--color-cyan)",
                fontFamily:   "var(--font-mono)",
                border:       "1px solid rgba(6, 182, 212, 0.3)",
                cursor:       "pointer",
              }}
            >
              Filtered: {shortenAddress(focus)} ✕
            </button>
          )}
        </div>

        <div className="ledger-controls">
          <div className="search-box">
            <Search size={14} className="search-icon" />
            <input
              type="text"
              className="search-input"
              placeholder="Search hash, address, or token…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="ledger-table-wrapper">
        <table className="ledger-table">
          <thead>
            <tr>
              <th>From Address</th>
              <th>To Address</th>
              <th>Tx Hash</th>
              <th>Token</th>
              <th>Amount</th>
              <th>Timestamp</th>
            </tr>
          </thead>
          <tbody>
            {filteredEdges.length > 0 ? (
              filteredEdges.map((e: any, idx: number) => {
                const isFocused =
                  focus &&
                  (e.fromAddress.toLowerCase() === focus.toLowerCase() ||
                    e.toAddress.toLowerCase() === focus.toLowerCase());

                const rowKey = `${e.txHash}-${idx}`;

                // Amount colour: amber for stablecoins, cyan for native
                const isStable = ["USDT", "USDC", "DAI", "BUSD"].includes(
                  (e.tokenSymbol || "").toUpperCase()
                );
                const amountColor = isStable
                  ? "var(--color-warning)"
                  : "var(--color-cyan)";

                return (
                  <tr key={rowKey} className={isFocused ? "focused-row" : ""}>
                    <td>
                      <span>{shortenAddress(e.fromAddress)}</span>
                      <button type="button" className="copy-btn"
                        onClick={() => handleCopy(e.fromAddress, `from-${idx}`)}
                        title="Copy Address">
                        {copiedId === `from-${idx}` ? <Check size={12} className="text-success" /> : <Copy size={12} />}
                      </button>
                    </td>
                    <td>
                      <span>{shortenAddress(e.toAddress)}</span>
                      <button type="button" className="copy-btn"
                        onClick={() => handleCopy(e.toAddress, `to-${idx}`)}
                        title="Copy Address">
                        {copiedId === `to-${idx}` ? <Check size={12} className="text-success" /> : <Copy size={12} />}
                      </button>
                    </td>
                    <td>
                      <span>{shortenHash(e.txHash)}</span>
                      <button type="button" className="copy-btn"
                        onClick={() => handleCopy(e.txHash, `hash-${idx}`)}
                        title="Copy Tx Hash">
                        {copiedId === `hash-${idx}` ? <Check size={12} className="text-success" /> : <Copy size={12} />}
                      </button>
                    </td>
                    <td>
                      <TokenBadge
                        symbol={e.tokenSymbol}
                        transferType={e.transferType}
                      />
                    </td>
                    <td style={{ color: amountColor, fontWeight: 600 }}>
                      {formatAmount(e.amount, e.tokenSymbol)}
                    </td>
                    <td style={{ color: "var(--color-text-muted)" }}>
                      {formatDate(e.txTimestamp)}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={6} style={{ textAlign: "center", padding: "30px", color: "var(--color-text-muted)" }}>
                  No transfers match the current filter or search criteria.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
