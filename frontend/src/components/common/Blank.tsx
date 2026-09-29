import { motion } from "framer-motion";
import { Search, Loader2, AlertTriangle, FileText, Download } from "lucide-react";

interface Props {
  busy: boolean;
  chain: string;
  status: "idle" | "running" | "completed" | "failed" | "partial";
  error?: string | null;
}

export default function Blank({ busy, chain, status, error }: Props) {
  if (status === "running") {
    return (
      <div className="empty-canvas">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
          className="empty-icon"
        >
          <Loader2 size={32} />
        </motion.div>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", textAlign: "left" }}>
          <h3 style={{ fontSize: "14px", fontWeight: 600, color: "var(--color-text)" }}>INVESTIGATION RUNNING</h3>
          <div style={{ fontSize: "12px", color: "var(--color-success)" }}>✓ Validating wallet</div>
          <div style={{ fontSize: "12px", color: "var(--color-success)" }}>✓ Connecting to {chain !== "all" ? chain : "Blockchain"}</div>
          <div style={{ fontSize: "12px", color: "var(--color-primary)" }}>● Tracing transfers & resolving entities</div>
          <div style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>○ Assessing risk & preparing findings</div>
        </div>
      </div>
    );
  }

  if (status === "failed") {
    return (
      <div className="empty-canvas">
        <div className="empty-icon" style={{ borderColor: 'var(--color-danger)', color: 'var(--color-danger)', boxShadow: '0 0 30px var(--color-danger-glow)' }}>
          <AlertTriangle size={32} />
        </div>
        <div>
          <h3 style={{ fontSize: "14px", fontWeight: 600, color: "var(--color-text)", marginBottom: '8px' }}>INVESTIGATION FAILED</h3>
          <p style={{ fontSize: "12px", maxWidth: "300px" }}>{error || "An unknown error occurred during tracing."}</p>
        </div>
      </div>
    );
  }

  if (status === "partial") {
    return (
      <div className="empty-canvas">
        <div className="empty-icon" style={{ borderColor: 'var(--color-warning)', color: 'var(--color-warning)', boxShadow: '0 0 30px rgba(245, 158, 11, 0.25)' }}>
          <AlertTriangle size={32} />
        </div>
        <div>
          <h3 style={{ fontSize: "14px", fontWeight: 600, color: "var(--color-text)", marginBottom: '8px' }}>PARTIAL INVESTIGATION</h3>
          <p style={{ fontSize: "12px", maxWidth: "300px" }}>Some blockchain data could not be retrieved. Results may be incomplete.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="empty-canvas">
      <div className="empty-icon">
        <Search size={32} />
      </div>
      <div>
        <h3 style={{ fontSize: "16px", fontWeight: 600, color: "var(--color-text)", marginBottom: "4px" }}>Awaiting Target</h3>
        <p style={{ fontSize: "12px" }}>Start an investigation to visualize on-chain fund flows.</p>
      </div>
    </div>
  );
}
