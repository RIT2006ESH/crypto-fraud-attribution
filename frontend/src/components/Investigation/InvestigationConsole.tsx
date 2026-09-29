import { useState } from "react";
import { motion } from "framer-motion";
import { Search, CheckCircle2, Loader2, Play, Zap } from "lucide-react";
import type { ChainInfo, TraceInput } from "../../types";
import { isAddress, detectChain } from "../../address";

interface Props {
  onSubmit: (input: TraceInput) => void;
  busy: boolean;
  chains?: ChainInfo[];
}

// Presets grouped by chain
const ETH_PRESETS = [
  { label: "Binance Deposit",    addr: "0x28C6c06298d514Db089934071355E5743bf21d60" },
  { label: "Coinbase Hot Wallet", addr: "0x71660c4005BA85c37ccec55d0C4493E66Fe775d3" },
  { label: "Kraken Deposit",     addr: "0x2910543Af39abA0Cd09dBb2D50200b3E800A63D2" },
  { label: "Tornado Cash Pool",  addr: "0x12D66f87A04A9E220743712cE6d9bB1B5616B8Fc" },
];

const TRON_PRESETS = [
  { label: "Binance TRX Deposit", addr: "TBaMdtbTsH7XExJFmqNKmDzf84Gs35eSXJ" },
  { label: "OKX TRX Deposit",     addr: "TXmVpin5vgaDFnEKHwMDsZRHMq74gLZ9BG" },
  { label: "KuCoin TRX Deposit",  addr: "TXRzNNFxMriVUfxHyCLjQP9cDsQLmF1LGv" },
  { label: "HTX TRX Deposit",     addr: "TNaRAoLUyYEV2uF7GUrzFQrRBBpGGSBBjB" },
];

// "All Chains" shows 2 ETH + 2 Tron so investigator can try either format
const ALL_PRESETS = [
  ETH_PRESETS[0],
  ETH_PRESETS[2],
  TRON_PRESETS[0],
  TRON_PRESETS[1],
];

const CHAIN_META: Record<string, { label: string; placeholder: string; color: string; icon: string }> = {
  ethereum: {
    label: "Ethereum",
    placeholder: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
    color: "var(--color-primary)",
    icon: "⬡",
  },
  tron: {
    label: "Tron",
    placeholder: "TBaMdtbTsH7XExJFmqNKmDzf84Gs35eSXJ",
    color: "#e84142",
    icon: "◉",
  },
  all: {
    label: "All Chains",
    placeholder: "0x… or T… address",
    color: "var(--color-warning)",
    icon: "⚡",
  },
};

type ChainId = "ethereum" | "tron" | "all";

export default function TraceForm({ onSubmit, busy, chains = [] }: Props) {
  const [walletAddress, setWalletAddress] = useState("");
  const [caseId, setCaseId] = useState("");
  const [selectedChain, setSelectedChain] = useState<ChainId>("all");

  // When address changes, auto-detect chain if "All Chains" is selected.
  // Only switch away from "all" if the user hasn't explicitly picked a chain.
  const detectedChain = walletAddress.trim() ? detectChain(walletAddress.trim()) : null;
  const isValid = isAddress(walletAddress.trim());

  let validationFeedback = "";
  if (walletAddress.trim().length > 0) {
    if (!isValid) {
      validationFeedback = "INVALID ADDRESS";
    } else if (selectedChain !== "all" && detectedChain && detectedChain !== selectedChain) {
      validationFeedback = "CHAIN MISMATCH";
    } else {
      validationFeedback = "VALID";
    }
  }

  // Determine which presets to show based on selected chain.
  const presets =
    selectedChain === "ethereum" ? ETH_PRESETS :
    selectedChain === "tron"     ? TRON_PRESETS :
    ALL_PRESETS;

  // Available chain buttons — use backend data if loaded, fallback to defaults.
  const chainButtons: ChainId[] = chains.length > 0
    ? (chains.map(c => c.id).filter(id => ["ethereum","tron","all"].includes(id)) as ChainId[])
    : ["ethereum", "tron", "all"];

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!walletAddress.trim() || !isValid) return;

    // If "all" is selected, let the backend auto-detect from address format.
    // For explicit chain selection, pass it directly.
    onSubmit({
      walletAddress: walletAddress.trim(),
      chain: selectedChain,
      caseId: caseId.trim() || undefined,
    });
  }

  const meta = CHAIN_META[selectedChain];

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

      {/* Chain Selector Pill Buttons */}
      <div className="chain-selector">
        <span className="form-label">Target Chain</span>
        <div className="chain-pill-group">
          {chainButtons.map((chainId) => {
            const m = CHAIN_META[chainId];
            const isActive = selectedChain === chainId;
            // Build inline active style directly — avoids color-mix() and CSS var tricks
            const activeStyle: React.CSSProperties = isActive ? {
              background:  `${m.color}1f`,   // ~12% opacity
              borderColor: `${m.color}88`,   // ~53% opacity
              color:        m.color,
              boxShadow:   `0 0 14px ${m.color}33`,
            } : {};
            return (
              <button
                key={chainId}
                type="button"
                className={`chain-pill ${isActive ? "active" : ""}`}
                style={activeStyle}
                onClick={() => setSelectedChain(chainId)}
                disabled={busy}
                title={chainId === "all" ? "Auto-detects chain from address format" : m.label}
              >
                <span className="pill-icon">{m.icon}</span>
                <span>{m.label}</span>
                {chainId === "all" && <Zap size={10} style={{ opacity: 0.8 }} />}
              </button>
            );
          })}
        </div>
      </div>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        <div className="form-group">
          <label className="form-label" htmlFor="walletAddress">
            Target Wallet Address
            {detectedChain && selectedChain === "all" && (
              <span className="detected-chain-hint">
                · detected: {CHAIN_META[detectedChain]?.label ?? detectedChain}
              </span>
            )}
          </label>
          <div className="input-wrapper">
            <input
              id="walletAddress"
              type="text"
              className="form-input"
              placeholder={meta.placeholder}
              value={walletAddress}
              onChange={(e) => setWalletAddress(e.target.value)}
              disabled={busy}
              required
              spellCheck={false}
              autoComplete="off"
            />
            {isValid && validationFeedback === "VALID" && <CheckCircle2 size={16} className="valid-indicator" />}
          </div>
          {validationFeedback && (
            <div style={{
              fontSize: '10px',
              fontWeight: 600,
              marginTop: '4px',
              color: validationFeedback === 'VALID' ? 'var(--color-success)' :
                     validationFeedback === 'CHAIN MISMATCH' ? 'var(--color-warning)' : 'var(--color-danger)'
            }}>
              {validationFeedback}
            </div>
          )}
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="caseId">
            Case ID Reference <span style={{ opacity: 0.5 }}>(Optional)</span>
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
          disabled={busy || validationFeedback !== "VALID"}
          whileHover={{ scale: (busy || validationFeedback !== "VALID") ? 1 : 1.02 }}
          whileTap={{ scale: (busy || validationFeedback !== "VALID") ? 1 : 0.98 }}
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

      {/* Preset Forensic Targets */}
      <div className="presets-container">
        <span className="presets-label">
          Preset Forensic Targets
          {selectedChain !== "all" && (
            <span style={{ color: "var(--color-text-muted)", textTransform: "none", marginLeft: "4px" }}>
              · {CHAIN_META[selectedChain].label}
            </span>
          )}
        </span>
        <div className="preset-grid">
          {presets.map((p) => (
            <button
              key={p.addr}
              type="button"
              className="preset-chip"
              onClick={() => setWalletAddress(p.addr)}
              disabled={busy}
              title={p.addr}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
