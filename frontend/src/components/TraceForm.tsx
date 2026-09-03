import { useState } from "react";
import { motion } from "framer-motion";
import { Search, CheckCircle2, Loader2, Play } from "lucide-react";
import type { TraceInput } from "../types";

interface Props {
  onSubmit: (input: TraceInput) => void;
  busy: boolean;
}

const PRESETS = [
  { label: "Binance Deposit", addr: "0x28C6c06298d514Db089934071355E5743bf21d60" },
  { label: "Coinbase Hot Wallet", addr: "0x71660c4005BA85c37ccec55d0C4493E66Fe775d3" },
  { label: "Kraken Deposit", addr: "0x2910543Af39abA0Cd09dBb2D50200b3E800A63D2" },
  { label: "Tornado Cash Pool", addr: "0x12D66f87A04A9E220743712cE6d9bB1B5616B8Fc" },
];

export default function TraceForm({ onSubmit, busy }: Props) {
  const [walletAddress, setWalletAddress] = useState("");
  const [caseId, setCaseId] = useState("");

  const isValidEth = /^0x[a-fA-F0-9]{40}$/.test(walletAddress.trim());

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!walletAddress.trim()) return;
    onSubmit({
      walletAddress: walletAddress.trim(),
      chain: "ethereum",
      caseId: caseId.trim() || undefined,
    });
  }

  return (
    <motion.div
      className="glass-panel card-section"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="card-header">
        <h3 className="card-title">
          <Search size={16} className="text-primary" />
          Investigation Console
        </h3>
      </div>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        <div className="form-group">
          <label className="form-label" htmlFor="walletAddress">
            Target Wallet Address
          </label>
          <div className="input-wrapper">
            <input
              id="walletAddress"
              type="text"
              className="form-input"
              placeholder="0x742d35Cc6634C0532925a3b844Bc454e4438f44e"
              value={walletAddress}
              onChange={(e) => setWalletAddress(e.target.value)}
              disabled={busy}
              required
            />
            {isValidEth && <CheckCircle2 size={16} className="valid-indicator" />}
          </div>
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="chain">
            Target Chain
          </label>
          <div className="input-wrapper">
            <input
              id="chain"
              type="text"
              className="form-input"
              value="Ethereum (Mainnet)"
              disabled
            />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="caseId">
            Case ID Reference (Optional)
          </label>
          <div className="input-wrapper">
            <input
              id="caseId"
              type="text"
              className="form-input"
              placeholder="e.g. CF-2041"
              value={caseId}
              onChange={(e) => setCaseId(e.target.value)}
              disabled={busy}
            />
          </div>
        </div>

        <motion.button
          type="submit"
          className="btn-investigate"
          disabled={busy || !walletAddress.trim()}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          {busy ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              <span>Tracing Blockchain...</span>
            </>
          ) : (
            <>
              <Play size={16} fill="currentColor" />
              <span>Run Investigation</span>
            </>
          )}
        </motion.button>
      </form>

      <div className="presets-container">
        <span className="presets-label">Preset Forensic Targets</span>
        <div className="preset-grid">
          {PRESETS.map((p) => (
            <button
              key={p.addr}
              type="button"
              className="preset-chip"
              onClick={() => setWalletAddress(p.addr)}
              disabled={busy}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
