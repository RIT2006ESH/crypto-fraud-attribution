import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, Check, ChevronDown, Crosshair, Info, Loader2, Play, RotateCcw, TriangleAlert, X } from 'lucide-react';
import type { ChainInfo, TraceInput } from '../../types';
import { CHAIN_PICKER_IDS, addressMatchesChain, chainMeta } from '../../lib/chains';
import { STAGES, type RunState, type Stage } from '../../state/investigationReducer';
import { EASE } from '../../lib/motion';

/**
 * The submission rail.
 *
 * Validation is client-side and deliberately conservative: it checks the address
 * *format* and warns on a chain mismatch, but it never claims to know whether an
 * address exists or who owns it. The backend remains the authority, and the interface
 * never softens its verdict — a wrong "unlabelled" is worse than an honest one.
 */

interface Props {
  chains: ChainInfo[];
  selectedChain: string;
  onChainChange: (chain: string) => void;
  onRun: (input: TraceInput) => void;
  onReset: () => void;
  run: RunState;
  stage: Stage;
  elapsedMs: number | null;
  error: string | null;
}

const ETHEREUM_RE = /^0x[a-fA-F0-9]{40}$/;
const TRON_RE = /^T[1-9A-HJ-NP-Za-km-z]{33}$/;

type Feedback =
  | { kind: 'idle' }
  | { kind: 'valid'; chain: string; detected: string }
  | { kind: 'warn'; message: string }
  | { kind: 'error'; message: string };

export default function TargetPanel({
  chains,
  selectedChain,
  onChainChange,
  onRun,
  onReset,
  run,
  stage,
  elapsedMs,
  error,
}: Props) {
  const [address, setAddress] = useState('');
  const [caseId, setCaseId] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [touched, setTouched] = useState(false);

  const feedback = useMemo<Feedback>(() => validate(address, selectedChain), [address, selectedChain]);
  const busy = run === 'running';
  const canRun = address.trim().length > 0 && feedback.kind !== 'error' && !busy;

  const submit = () => {
    setTouched(true);
    if (!canRun) return;
    onRun({
      walletAddress: address.trim(),
      chain: selectedChain,
      caseId: caseId.trim() || undefined,
    });
  };

  return (
    <>
      <div className="glass-panel card-section">
        <div className="card-header">
          <h2 className="card-title">Reported wallet</h2>
          <button
            type="button"
            className="copy-btn"
            onClick={onReset}
            disabled={run === 'idle'}
            aria-label="Clear the current case"
          >
            <RotateCcw size={13} aria-hidden />
            New case
          </button>
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <div className="form-group">
            <label className="form-label" htmlFor="target-address">
              Address
            </label>
            <div className="input-wrapper">
              <input
                id="target-address"
                className="chain-pill"
                style={{ width: '100%', textAlign: 'left' }}
                value={address}
                onChange={(event) => {
                  setAddress(event.target.value);
                  setTouched(true);
                }}
                placeholder="0x… or T…"
                autoComplete="off"
                spellCheck={false}
                inputMode="text"
                aria-describedby="target-feedback"
                aria-invalid={touched && feedback.kind === 'error'}
              />
              {address ? (
                <button
                  type="button"
                  className="field-clear"
                  onClick={() => setAddress('')}
                  aria-label="Clear the address"
                >
                  <X size={12} aria-hidden />
                </button>
              ) : null}
            </div>

            {touched && feedback.kind !== 'idle' ? (
              <p
                id="target-feedback"
                className={`field-feedback field-feedback--${feedback.kind}`}
                role="status"
              >
                {feedback.kind === 'valid' ? (
                  <>
                    <Check size={12} aria-hidden /> Valid {chainMeta(feedback.chain).label} address
                  </>
                ) : feedback.kind === 'warn' ? (
                  <>
                    <TriangleAlert size={12} aria-hidden /> {feedback.message}
                  </>
                ) : feedback.kind === 'error' ? (
                  <>
                    <AlertCircle size={12} aria-hidden /> {feedback.message}
                  </>
                ) : null}
              </p>
            ) : (
              <p className="detected-chain-hint">
                Ethereum addresses start <code>0x</code>; Tron addresses start <code>T</code>.
              </p>
            )}
          </div>

          <div className="form-group">
            <span className="form-label">Chain</span>
            <div className="chain-pill-group" role="radiogroup" aria-label="Chain">
              {CHAIN_PICKER_IDS.map((id) => {
                const live = chains.find((c) => c.id === id);
                const meta = chainMeta(id);
                const active = selectedChain === id;
                return (
                  <button
                    key={id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    className={`chain-pill${active ? ' chain-pill--active' : ''}`}
                    onClick={() => onChainChange(id)}
                  >
                    {meta.short}
                    {live ? null : <span className="pill-icon" aria-hidden>·</span>}
                  </button>
                );
              })}
            </div>
            <p className="detected-chain-hint">{chainMeta(selectedChain).addressFormat}</p>
          </div>

          <button type="button" className="disclosure__trigger" onClick={() => setShowAdvanced((v) => !v)} aria-expanded={showAdvanced}>
            <span>Advanced</span>
            <ChevronDown
              size={14}
              aria-hidden
              style={{ transform: showAdvanced ? 'rotate(180deg)' : 'none', transition: `transform var(--motion-normal) var(--ease-out-expo)` }}
            />
          </button>

          <AnimatePresence initial={false}>
            {showAdvanced ? (
              <motion.div
                className="disclosure__body"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.28, ease: EASE.out }}
              >
                <div className="form-group">
                  <label className="form-label" htmlFor="case-id">
                    Case reference <span style={{ color: 'var(--text-faint)' }}>· optional</span>
                  </label>
                  <input
                    id="case-id"
                    className="chain-pill"
                    style={{ width: '100%', textAlign: 'left' }}
                    value={caseId}
                    onChange={(event) => setCaseId(event.target.value)}
                    placeholder="CF-2041"
                    autoComplete="off"
                  />
                  <p className="disclosure__note">
                    Appears in the case bar and the exported report. Leave blank and a trace
                    reference is generated instead.
                  </p>
                </div>

                <div className="form-group">
                  <span className="form-label">Trace depth</span>
                  <p className="disclosure__note" style={{ marginTop: 4 }}>
                    {chainMeta(selectedChain).label} is traced to{' '}
                    <strong style={{ color: 'var(--text-secondary)' }}>4 hops</strong> with a
                    fan-out of 10 per address. Both limits are set by the investigation
                    service, not by the browser, and cannot be raised from here.
                  </p>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>

          <div className="action-row" style={{ marginTop: 16 }}>
            <button type="submit" className="btn btn--primary btn--block" disabled={!canRun}>
              {busy ? <Loader2 size={15} className="spin" aria-hidden /> : <Play size={15} aria-hidden />}
              {busy ? 'Tracing…' : 'Run investigation'}
            </button>
          </div>
        </form>
      </div>

      <RunProgress run={run} stage={stage} elapsedMs={elapsedMs} />
      {error ? <StateBanner tone="error" title="Investigation failed" message={error} /> : null}
    </>
  );
}

/** Stage list. Shown while running and retained afterwards as a record. */
function RunProgress({ run, stage, elapsedMs }: { run: RunState; stage: Stage; elapsedMs: number | null }) {
  if (run === 'idle') {
    return (
      <div className="glass-panel card-section">
        <p className="disclosure__note" style={{ margin: 0 }}>
          <Crosshair size={13} aria-hidden style={{ verticalAlign: '-2px', marginRight: 6 }} />
          Submit a wallet address to open a case. Nothing is traced until you do.
        </p>
      </div>
    );
  }

  const activeIndex = STAGES.findIndex((s) => s.id === stage);

  return (
    <div className="glass-panel card-section">
      <div className="card-header">
        <h3 className="card-title">Pipeline</h3>
        {elapsedMs !== null ? (
          <span className="tagline">{(elapsedMs / 1000).toFixed(2)}s</span>
        ) : null}
      </div>

      <ol className="progress-list" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {STAGES.map((step, i) => {
          const done = run !== 'running' || i < activeIndex;
          const active = run === 'running' && i === activeIndex;
          const failed = run === 'failed' && i === activeIndex;
          return (
            <li
              key={step.id}
              className={`progress-step${
                failed ? ' progress-step--failed' : active ? ' progress-step--active' : done ? ' progress-step--done' : ''
              }`}
            >
              <span className="progress-step__glyph" aria-hidden>
                {failed ? <X size={11} /> : done ? <Check size={11} /> : active ? <Loader2 size={11} className="spin" /> : i + 1}
              </span>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 'var(--fs-small)', fontWeight: 600 }}>{step.label}</span>
                <span style={{ display: 'block', fontSize: 'var(--fs-micro)', color: 'var(--text-faint)', lineHeight: 1.5 }}>
                  {step.detail}
                </span>
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function StateBanner({
  tone,
  title,
  message,
}: {
  tone: 'error' | 'warn';
  title: string;
  message: string;
}) {
  const Icon = tone === 'error' ? AlertCircle : Info;
  return (
    <motion.div
      className={`state-banner state-banner--${tone}`}
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: EASE.out }}
      role={tone === 'error' ? 'alert' : 'status'}
    >
      <Icon size={16} aria-hidden style={{ flexShrink: 0, marginTop: 2 }} />
      <span>
        <strong className="state-banner__title">{title}</strong>
        <span style={{ display: 'block', marginTop: 4, lineHeight: 1.55 }}>{message}</span>
      </span>
    </motion.div>
  );
}

/** Client-side format check. Deliberately says nothing about ownership or existence. */
function validate(address: string, chain: string): Feedback {
  const value = address.trim();
  if (!value) return { kind: 'idle' };

  const looksEthereum = ETHEREUM_RE.test(value);
  const looksTron = TRON_RE.test(value);

  if (!looksEthereum && !looksTron) {
    return {
      kind: 'error',
      message: 'Not a recognised address format. Ethereum is 0x + 40 hex; Tron is T + 33 base-58.',
    };
  }

  const detected = looksEthereum ? 'ethereum' : 'tron';

  if (!addressMatchesChain(value, chain)) {
    return {
      kind: 'warn',
      message: `This looks like a ${chainMeta(detected).short} address, but ${chainMeta(chain).short} is selected. The trace will not find it there.`,
    };
  }

  return { kind: 'valid', chain: detected, detected };
}
