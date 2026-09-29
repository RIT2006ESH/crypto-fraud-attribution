import { Link } from 'react-router-dom';
import { PanelLeft } from 'lucide-react';
import BrandMark from '../common/BrandMark';
import { chainMeta } from '../../lib/chains';
import { shortenAddress } from '../../format';
import type { TraceResult } from '../../types';
import { ThemeToggle } from '../common/ThemeToggle';

interface Props {
  statusClass: string;
  statusLabel: string;
  chain: string;
  result: TraceResult | null;
  caseId: string;
  onToggleRail: () => void;
}

/**
 * The case bar.
 *
 * Deliberately thin: a masthead that grows to hold findings is a masthead that pushes
 * the graph off screen. The case identity, chain and run state are all it carries.
 */
export default function WorkspaceMasthead({
  statusClass,
  statusLabel,
  chain,
  result,
  caseId,
  onToggleRail,
}: Props) {
  const meta = chainMeta(chain);
  const address = result?.walletAddress ?? '';

  return (
    <header className="masthead">
      <div className="brand-section">
        <span className="brand-logo">
          <BrandMark size={17} title="CASETRACE" />
        </span>
        <span className="brand-text">
          <span className="wordmark">CASETRACE</span>
          <span className="tagline">Investigation workstation</span>
        </span>
      </div>

      <div className="masthead__center">
        <span className="case-chip">
          <span className="case-chip__id">{caseId}</span>
          {address ? <span className="case-chip__addr">{shortenAddress(address)}</span> : null}
        </span>
        <span className="chain-badge">{meta.label}</span>
      </div>

      <div className="header-badges">
        <button
          type="button"
          className="workspace-rail-toggle btn btn--quiet btn--sm"
          onClick={onToggleRail}
          aria-label="Show or hide the case rail"
        >
          <PanelLeft size={14} aria-hidden />
          Case
        </button>
        <span className={statusClass}>
          {statusLabel === 'Running' ? <span className="pulse-dot" aria-hidden /> : null}
          {statusLabel}
        </span>
        <ThemeToggle />
        <Link to="/" className="btn btn--quiet btn--sm">
          Site
        </Link>
      </div>
    </header>
  );
}
