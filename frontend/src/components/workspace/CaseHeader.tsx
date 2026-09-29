import { useState } from 'react';
import { Check, Copy, Moon, PanelLeft, Plus, Sun } from 'lucide-react';
import BrandMark from '../common/BrandMark';
import { chainMeta } from '../../lib/chains';
import { shortenAddress } from '../../format';
import { useTheme } from '../../lib/theme';
import type { RunState } from '../../state/investigationReducer';

interface Props {
  run: RunState;
  chain: string;
  caseId: string;
  address: string;
  nodeCount: number;
  transferCount: number;
  /** Aggregated connections, which is what the graph actually draws. */
  edgeCount: number;
  traceMs: number | null;
  partial: boolean;
  hasResult: boolean;
  onToggleRail: () => void;
  onNewCase: () => void;
}

/**
 * The case bar.
 *
 * Fixed height, four zones, and nothing that changes size when a value changes: a bar
 * that grows to fit a longer case reference pushes the graph off screen, which is the
 * one thing the graph cannot afford. Every figure here is a trace-wide fact an
 * investigator would otherwise have to count by hand, and the copy control sits on the
 * case reference because that is the string that gets filed.
 */
export default function CaseHeader({
  run,
  chain,
  caseId,
  address,
  nodeCount,
  transferCount,
  edgeCount,
  traceMs,
  partial,
  hasResult,
  onToggleRail,
  onNewCase,
}: Props) {
  const { theme, toggle } = useTheme();
  const [copied, setCopied] = useState(false);
  const meta = chainMeta(chain);

  const copyCase = async () => {
    if (!caseId || caseId === '—') return;
    try {
      await navigator.clipboard.writeText(caseId);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* Clipboard access can be refused. A failed copy is not worth interrupting a
         case for, and the reference is visible on screen to copy by hand. */
    }
  };

  return (
    <header className="case-header">
      <div className="case-header__brand">
        <button
          type="button"
          className="icon-btn icon-btn--bare"
          onClick={onToggleRail}
          aria-label="Show or hide the investigation console"
          aria-pressed={undefined}
        >
          <PanelLeft size={15} aria-hidden />
        </button>
        <span className="brand-logo brand-logo--sm">
          <BrandMark size={15} title="CASETRACE" />
        </span>
        <span className="case-header__wordmark">
          <span className="wordmark">CASETRACE</span>
          <span className="case-header__sub">Attribution workstation</span>
        </span>
        <button type="button" className="btn btn--quiet btn--sm" onClick={onNewCase}>
          <Plus size={13} aria-hidden />
          New case
        </button>
      </div>

      <div className="case-header__identity">
        <HeaderField label="Case" value={caseId} mono>
          <button
            type="button"
            className="copy-inline"
            onClick={copyCase}
            aria-label={copied ? 'Case reference copied' : 'Copy case reference'}
            disabled={!hasResult}
          >
            {copied ? <Check size={11} aria-hidden /> : <Copy size={11} aria-hidden />}
          </button>
        </HeaderField>
        <HeaderField label="Target" value={address ? shortenAddress(address) : '—'} mono />
        <HeaderField label="Chain" value={meta.label} />
      </div>

      <div className="case-header__metrics">
        <span className={`status-pill status-pill--${run}`}>
          <span className="status-pill__dot" aria-hidden />
          {run === 'partial' ? 'Partial' : run === 'running' ? 'Tracing' : runLabel(run)}
        </span>
        {hasResult ? (
          <>
            <Metric label="Nodes" value={String(nodeCount)} />
            <Metric label="Transfers" value={String(transferCount)} />
            <Metric label="Links" value={String(edgeCount)} hint="Transfers aggregated into connections" />
            <Metric label="Trace" value={traceMs === null ? '—' : formatDuration(traceMs)} />
            {partial ? <span className="header-note">Coverage incomplete</span> : null}
          </>
        ) : null}
        <button
          type="button"
          className="icon-btn icon-btn--bare"
          onClick={toggle}
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
        >
          {theme === 'dark' ? <Sun size={15} aria-hidden /> : <Moon size={15} aria-hidden />}
        </button>
      </div>
    </header>
  );
}

function runLabel(run: RunState): string {
  switch (run) {
    case 'completed':
      return 'Completed';
    case 'failed':
      return 'Failed';
    case 'running':
      return 'Running';
    default:
      return 'No active case';
  }
}

function HeaderField({
  label,
  value,
  mono,
  children,
}: {
  label: string;
  value: string;
  mono?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <span className="header-field">
      <span className="header-field__label">{label}</span>
      <span className={`header-field__value${mono ? ' is-mono' : ''}`}>
        {value}
        {children}
      </span>
    </span>
  );
}

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <span className="header-metric" title={hint}>
      <span className="header-metric__label">{label}</span>
      <span className="header-metric__value is-mono">{value}</span>
    </span>
  );
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${Math.round(seconds % 60)}s`;
}
