import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Header from "./components/Header/Header";
import InvestigationConsole from "./components/Investigation/InvestigationConsole";
import FlowMap from "./components/Graph/FlowMap";
import FilterBar from "./components/Graph/FilterBar";
import Ledger from "./components/Ledger/Ledger";
import Blank from "./components/common/Blank";
import { Attribution, CaseFacts, RiskStamp } from "./components/Intelligence/Verdict";
import { submitTrace, fetchChains } from "./api";
import type { ChainInfo, TraceInput, TraceResult } from "./types";
import { AlertCircle } from "lucide-react";

export default function App() {
  const [result, setResult] = useState<TraceResult | null>(null);
  const [status, setStatus] = useState<"idle" | "running" | "completed" | "failed">("idle");
  const [error, setError] = useState<string | null>(null);
  const [focus, setFocus] = useState<string | null>(null);
  const [chains, setChains] = useState<ChainInfo[]>([]);
  /** The chain the last trace was submitted on — drives the Header badge. */
  const [activeChain, setActiveChain] = useState<string>("all");
  const [activeFilter, setActiveFilter] = useState<string>("all");

  // Fetch supported chains from backend on mount.
  useEffect(() => {
    fetchChains()
      .then(setChains)
      .catch(() => {
        // Fallback if backend is unreachable — show built-in chain list.
        setChains([
          { id: "ethereum", name: "Ethereum", nativeSymbol: "ETH", tokens: ["USDT", "USDC"] },
          { id: "tron",     name: "Tron",     nativeSymbol: "TRX", tokens: ["USDT", "USDC"] },
          { id: "all",      name: "All Chains", nativeSymbol: "", tokens: [], multi: true },
        ]);
      });
  }, []);

  async function runTrace(input: TraceInput) {
    setStatus("running");
    setError(null);
    setFocus(null);
    setActiveChain(input.chain || "all");
    try {
      const res = await submitTrace(input);
      setResult(res);
      setStatus("completed");
    } catch (e) {
      setResult(null);
      setError(e instanceof Error ? e.message : "The trace service could not be reached.");
      setStatus("failed");
    }
  }

  const clearFocus = useCallback(() => setFocus(null), []);

  return (
    <div className="app-container">
      <Header result={result} activeChain={activeChain} />

      <div className="workspace-layout">
        {/* Left Sidebar Rail */}
        <aside className="sidebar-rail">
          <InvestigationConsole onSubmit={runTrace} busy={status === "running"} chains={chains} />

          <AnimatePresence mode="wait">
            {error && (
              <motion.div
                key="error"
                className="glass-panel card-section"
                style={{ borderColor: "rgba(239, 68, 68, 0.4)", boxShadow: "0 0 25px rgba(239, 68, 68, 0.2)" }}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px", color: "var(--color-danger)" }}>
                  <AlertCircle size={20} />
                  <strong style={{ fontSize: "14px" }}>Investigation Failed</strong>
                </div>
                <p style={{ fontSize: "12px", color: "var(--color-text-muted)", lineHeight: 1.4 }}>
                  {error}
                </p>
              </motion.div>
            )}

            {result && status === "completed" && (
              <motion.div
                key="results"
                style={{ display: "flex", flexDirection: "column", gap: "16px" }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.4 }}
              >
                <Attribution result={result} />
                <RiskStamp result={result} />
                <CaseFacts result={result} />
              </motion.div>
            )}
          </AnimatePresence>
        </aside>

        {/* Right Canvas Workspace */}
        <main className="canvas-workspace">
          <div className="canvas-toolbar-header">
            <h2 className="canvas-title">On-Chain Fund Flow Map</h2>
            <div className="graph-legend">
              <div className="legend-item">
                <span className="legend-swatch root" />
                <span>Reported Wallet</span>
              </div>
              <div className="legend-item">
                <span className="legend-swatch exchange" />
                <span>Exchange / VASP</span>
              </div>
              <div className="legend-item">
                <span className="legend-swatch mixer" />
                <span>Mixer</span>
              </div>
              <div className="legend-item">
                <span className="legend-swatch sanctioned" />
                <span>Sanctioned</span>
              </div>
              <div className="legend-item">
                <span className="legend-swatch unlabelled" />
                <span>Unlabelled</span>
              </div>
              <div className="legend-item">
                <span className="legend-swatch stablecoin-edge" />
                <span>Stablecoin</span>
              </div>
              <div className="legend-item">
                <span className="legend-swatch token-edge" />
                <span>Token</span>
              </div>
            </div>
          </div>
          
          <FilterBar activeFilter={activeFilter} onFilterChange={setActiveFilter} />

          <div style={{ flex: 1, position: "relative" }}>
            {result && result.nodes && result.nodes.length > 0 ? (
              <FlowMap result={result} onSelect={setFocus} />
            ) : (
              <Blank busy={status === "running"} chain={activeChain} status={status} error={error} />
            )}
          </div>

          {result && <Ledger result={result} focus={focus} onClearFocus={clearFocus} />}
        </main>
      </div>
    </div>
  );
}

