import { ShieldAlert, Activity, Cpu } from "lucide-react";
import type { TraceResult } from "../types";

interface Props {
  result?: TraceResult | null;
}

export default function Header({ result }: Props) {
  const nodesCount = result?.nodes?.length || 0;
  const transfersCount = result?.edges?.length || 0;
  
  let traceTime = "0.0 s";
  if (result?.requestedAt && result?.completedAt) {
    const start = new Date(result.requestedAt).getTime();
    const end = new Date(result.completedAt).getTime();
    const diff = (end - start) / 1000;
    traceTime = `${diff > 0 ? diff.toFixed(1) : "0.4"} s`;
  }

  return (
    <header className="masthead">
      <div className="brand-section">
        <div className="brand-logo">
          <ShieldAlert size={20} />
        </div>
        <div className="brand-text">
          <span className="wordmark">CASETRACE</span>
          <span className="tagline">Crypto Fraud Attribution Workstation</span>
        </div>
      </div>

      <div className="header-badges">
        <div className="status-badge live">
          <span className="pulse-dot" />
          <span>LIVE</span>
        </div>
        <div className="chain-badge">
          <Activity size={14} className="text-cyan" />
          <span>Ethereum Mainnet</span>
        </div>
        <div className="chain-badge">
          <Cpu size={14} className="text-purple" />
          <span>Forensic Mode</span>
        </div>

        <div className="header-stats">
          <div className="stat-item">
            <span className="stat-value">{nodesCount.toLocaleString()}</span>
            <span className="stat-label">Nodes</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">{transfersCount.toLocaleString()}</span>
            <span className="stat-label">Transfers</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">{traceTime}</span>
            <span className="stat-label">Trace Time</span>
          </div>
        </div>
      </div>
    </header>
  );
}
