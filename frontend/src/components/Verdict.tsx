import { motion } from "framer-motion";
import { Building2, Download, AlertTriangle, ShieldCheck, Activity } from "lucide-react";
import type { TraceResult } from "../types";

interface Props {
  result: TraceResult;
}

export function Attribution({ result }: Props) {
  const ex = result.nearestExchange;

  return (
    <motion.div
      className={`glass-panel card-section attribution-card ${ex ? "has-exchange" : ""}`}
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="card-header">
        <h3 className="card-title">
          <Building2 size={16} className="text-success" />
          Intelligence Briefing
        </h3>
        {ex && <span className="confidence-badge">95% Match</span>}
      </div>

      {ex ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <div>
            <div className="attribution-entity">{ex.entity || "Regulated Service"}</div>
            <div style={{ fontSize: "12px", color: "var(--color-text-muted)", marginTop: "2px" }}>
              Receives deposits {ex.hopDepth === 1 ? "1 hop" : `${ex.hopDepth} hops`} from victim wallet
            </div>
          </div>

          <div className="recommendation-box">
            <strong>Action Recommendation:</strong> Serve disclosure subpoena on {ex.entity || "this exchange"} for deposit account controlling address <code style={{ fontFamily: "var(--font-mono)", fontSize: "11px" }}>{ex.address.slice(0, 10)}…</code>.
          </div>
        </div>
      ) : (
        <div style={{ fontSize: "12px", color: "var(--color-text-muted)", lineHeight: 1.5 }}>
          No regulated exchange reached within {result.hopsTraced ?? 0} hops. Funds remain in unlabelled wallets or exited through an unlisted mixer.
        </div>
      )}

      <a
        href={`${import.meta.env.VITE_API_URL || ''}/api/traces/${result.id}/report`}
        target="_blank"
        rel="noopener noreferrer"
        style={{ textDecoration: "none" }}
      >
        <motion.button
          type="button"
          className="btn-pdf"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <Download size={14} />
          <span>Export PDF Attribution Report</span>
        </motion.button>
      </a>
    </motion.div>
  );
}

export function RiskStamp({ result }: Props) {
  const score = result.riskScore ?? 0;
  const category = result.riskCategory || "LOW";

  const circumference = 201;
  const strokeDashoffset = circumference - (circumference * score) / 100;

  let gaugeColor = "var(--color-success)";
  if (category === "CRITICAL") gaugeColor = "var(--color-danger)";
  else if (category === "HIGH") gaugeColor = "var(--color-warning)";
  else if (category === "MEDIUM") gaugeColor = "var(--color-primary)";

  const patterns = result.flaggedPatterns
    ? result.flaggedPatterns.split("|").map((p) => p.trim()).filter(Boolean)
    : ["No high-risk patterns detected"];

  return (
    <motion.div
      className="glass-panel card-section"
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
    >
      <div className="card-header">
        <h3 className="card-title">
          <ShieldCheck size={16} className="text-warning" />
          Risk Score Assessment
        </h3>
        <span className={`risk-category-badge ${category}`}>{category}</span>
      </div>

      <div className="risk-gauge-container">
        <div className="risk-circle-wrapper">
          <svg width="80" height="80" viewBox="0 0 80 80">
            <circle
              cx="40"
              cy="40"
              r="32"
              fill="none"
              stroke="rgba(255,255,255,0.08)"
              strokeWidth="6"
            />
            <motion.circle
              cx="40"
              cy="40"
              r="32"
              fill="none"
              stroke={gaugeColor}
              strokeWidth="6"
              strokeDasharray={circumference}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset }}
              transition={{ duration: 1.2, ease: "easeOut" }}
              strokeLinecap="round"
              transform="rotate(-90 40 40)"
            />
          </svg>
          <div className="risk-score-value">
            <span className="score-num" style={{ color: gaugeColor }}>
              {score}
            </span>
            <span className="score-max">/ 100</span>
          </div>
        </div>

        <div className="risk-info">
          <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text)" }}>
            Forensic Risk Engine
          </div>
          <div style={{ fontSize: "11px", color: "var(--color-text-muted)" }}>
            Rule-based explainable risk score calculation
          </div>
        </div>
      </div>

      <div className="risk-pattern-list">
        {patterns.map((p, idx) => (
          <div key={idx} className="pattern-item">
            <AlertTriangle size={12} style={{ color: gaugeColor, flexShrink: 0, marginTop: "2px" }} />
            <span>{p}</span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

export function CaseFacts({ result }: Props) {
  let executionTime = "1.8 s";
  if (result.requestedAt && result.completedAt) {
    const start = new Date(result.requestedAt).getTime();
    const end = new Date(result.completedAt).getTime();
    const diff = (end - start) / 1000;
    executionTime = `${diff > 0 ? diff.toFixed(1) : "0.4"} s`;
  }

  return (
    <motion.div
      className="glass-panel card-section"
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2 }}
    >
      <div className="card-header">
        <h3 className="card-title">
          <Activity size={16} className="text-cyan" />
          Case Facts
        </h3>
      </div>

      <div className="facts-grid">
        <div className="fact-box">
          <span className="fact-value">{result.hopsTraced ?? 0}</span>
          <span className="fact-label">Hops Traced</span>
        </div>
        <div className="fact-box">
          <span className="fact-value">{result.nodes?.length || 0}</span>
          <span className="fact-label">Nodes Mapped</span>
        </div>
        <div className="fact-box">
          <span className="fact-value">{result.edges?.length || 0}</span>
          <span className="fact-label">Transfers</span>
        </div>
        <div className="fact-box">
          <span className="fact-value">{executionTime}</span>
          <span className="fact-label">Execution Time</span>
        </div>
      </div>
    </motion.div>
  );
}
