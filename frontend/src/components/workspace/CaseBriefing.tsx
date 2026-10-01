import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, Download, Info, TriangleAlert } from 'lucide-react';
import type { TraceResult } from '../../types';
import { entityMeta } from '../../lib/entities';
import { RISK_RULES, capScore, categorize, riskColor } from '../../lib/risk';
import { chainMeta } from '../../lib/chains';
import { hasReport, splitPatterns } from '../../api';
import { downloadReport } from '../../lib/report';
import { shortenAddress } from '../../format';
import { EASE } from '../../lib/motion';
import { RiskDial } from '../marketing/scenes/RiskDial';

/**
 * The case briefing.
 *
 * Reads top to bottom as the argument the product makes: what this wallet is, how
 * risky the trace looks and why, what the record contains, and how to take it away.
 * The export button is last because it is the outcome, not the entry point.
 *
 * Every field is read from the DTO the backend actually returns. Where a number is not
 * in the DTO it is not displayed rather than estimated.
 */
export default function CaseBriefing({ result, elapsedMs }: { result: TraceResult; elapsedMs: number | null }) {
  const [showModel, setShowModel] = useState(false);

  const address = (result.walletAddress || '').toLowerCase();
  const rootNode = result.nodes?.find((n) => n.address?.toLowerCase() === address);
  const labelType = rootNode?.labelType ?? null;
  const meta = entityMeta(labelType);
  const confidence = rootNode?.labelConfidence ?? null;

  const rawScore = typeof result.riskScore === 'number' ? result.riskScore : null;
  const score = rawScore === null ? null : capScore(rawScore);
  /* The backend's own category wins; `categorize` is only the fallback for a trace
     that came back without one. */
  const category = result.riskCategory ?? (score === null ? null : categorize(score));
  const color = riskColor(category);

  const hops = result.hopsTraced ?? result.nodes?.reduce((max, n) => Math.max(max, n.hopDepth ?? 0), 0) ?? 0;
  const nodeCount = result.nodes?.length ?? 0;
  const edgeCount = result.edges?.length ?? 0;
  /* The backend stores the sentence "No high-risk patterns detected" when no rule
     fires, so a non-empty string is not by itself evidence of a signal. */
  const patterns = firedSignals(result.flaggedPatterns);
  const limitations = result.limitations ?? [];

  return (
    <>
      <div className="glass-panel card-section">
        <div className="briefing">
          <span className="briefing__primary" style={{ color: meta.color }}>
            {labelType ? meta.label : 'Unlabelled wallet'}
          </span>
          <span className="briefing__entity-note">
            {labelType
              ? `Resolved from ${labelType.toLowerCase()} labelling at hop ${rootNode?.hopDepth ?? 0}. Verify the label before relying on it.`
              : 'No attribution was resolved for this address. The trace below is still complete — the identity simply is not public.'}
          </span>

          {confidence !== null ? (
            <div className="briefing__row">
              <span>Attribution confidence</span>
              <span className="briefing__conf">
                <span className="briefing__conf-num">{confidence.toFixed(2)}</span>
                <span className="briefing__conf-cap">resolved</span>
              </span>
            </div>
          ) : null}

          <div className="briefing__row">
            <span>Address</span>
            <span className="briefing__row-value">{shortenAddress(result.walletAddress)}</span>
          </div>
        </div>
      </div>

      <div className="glass-panel card-section">
        <div className="risk-info">
          <div className="risk-info__title" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {score === null ? (
              <span className="risk__dial risk__dial--sm">
                <span className="risk__dial-value">
                  <span className="risk__dial-num" style={{ color: 'var(--text-faint)' }}>
                    —
                  </span>
                </span>
              </span>
            ) : (
              <RiskDial score={score} color={color} size="sm" />
            )}
            <div style={{ minWidth: 0 }}>
              <span
                style={{
                  display: 'block',
                  fontFamily: 'var(--font-brand)',
                  fontSize: '1.25rem',
                  fontWeight: 600,
                  color,
                  lineHeight: 1.1,
                }}
              >
                {category ?? 'Not scored'}
              </span>
              <span className="tagline">
                {score === null ? 'No risk score returned' : `Risk category · ${score} / 100`}
              </span>
            </div>
          </div>
          <p className="risk-info__text">
            An indicator of suspicious activity derived from observable on-chain behaviour.
            It is a triage aid, not a determination of wrongdoing.
          </p>
        </div>

        {patterns.length > 0 ? (
          <>
            <span className="card-label">Signals that fired</span>
            <ul className="risk-factors" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {patterns.map((pattern, i) => (
                <li key={i} className="risk-factor">
                  <span className="risk-factor__name">{pattern}</span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="disclosure__note" style={{ margin: '12px 0 0' }}>
            No weighted risk rule fired on this trace. A zero score is not an all-clear: it
            means nothing in the traced subgraph triggered a rule.
          </p>
        )}

        <button
          type="button"
          className="explain__trigger"
          onClick={() => setShowModel((v) => !v)}
          aria-expanded={showModel}
        >
          <span>How this score is calculated</span>
          <ChevronDown
            size={14}
            aria-hidden
            style={{
              transform: showModel ? 'rotate(180deg)' : 'none',
              transition: `transform var(--motion-normal) var(--ease-out-expo)`,
            }}
          />
        </button>

        <AnimatePresence initial={false}>
          {showModel ? (
            <motion.div
              className="explain__body"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.28, ease: EASE.out }}
            >
              <ul className="explain__list" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {RISK_RULES.map((rule, i) => (
                  <li key={rule.id} className="explain__item">
                    <span className="explain__item-index">{String(i + 1).padStart(2, '0')}</span>
                    <span className="explain__item-text">
                      <strong style={{ color: 'var(--text-secondary)' }}>
                        +{rule.weight} · {rule.name}
                      </strong>
                      <br />
                      {rule.signal}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="disclosure__note" style={{ marginTop: 12 }}>
                The raw total is capped at 100 before the category is assigned. Thresholds:
                CRITICAL 75+, HIGH 50–74, MEDIUM 25–49, LOW below 25.
              </p>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      <MlIntelligence ml={result.ml} status={result.status} servedFromCache={result.servedFromCache} />

      <div className="glass-panel card-section">
        <div className="card-header">
          <h3 className="card-title">Case record</h3>
        </div>
        <div className="facts-grid">
          <Fact label="Chain" value={chainMeta(result.chain || 'all').short} />
          <Fact label="Coverage" value={`${hops} hop${hops === 1 ? '' : 's'}`} />
          <Fact label="Addresses" value={String(nodeCount)} />
          <Fact label="Transfers" value={String(edgeCount)} />
        </div>

        {/* Anything the service itself flagged as incomplete is stated here, in the
            record, rather than left for the investigator to infer from a low count. */}
        {limitations.length > 0 || result.failureReason ? (
          <div className="state-banner state-banner--warn" style={{ marginTop: 12 }}>
            <TriangleAlert size={14} aria-hidden style={{ flexShrink: 0, marginTop: 2 }} />
            <span>
              <strong className="state-banner__title">Coverage is incomplete</strong>
              {result.failureReason ? <span style={{ display: 'block' }}>{result.failureReason}</span> : null}
              {limitations.map((limitation, i) => (
                <span key={i} style={{ display: 'block' }}>
                  {limitation}
                </span>
              ))}
            </span>
          </div>
        ) : null}

        {result.findings?.summary ? (
          <p className="disclosure__note" style={{ marginTop: 12, marginBottom: 0 }}>
            {result.findings.summary} Reported by the investigation service.
          </p>
        ) : null}

        <p className="disclosure__note" style={{ marginTop: 12, marginBottom: 0 }}>
          <Info size={12} aria-hidden style={{ verticalAlign: '-2px', marginRight: 5 }} />
          {elapsedMs !== null ? `Traced in ${(elapsedMs / 1000).toFixed(2)}s` : 'Trace time unavailable'}
          {result.status ? ` · status ${result.status.toUpperCase()}` : ''}
          {result.servedFromCache ? ' · served from cache' : ''}
        </p>

        <div className="action-row">
          <button
            type="button"
            className="btn-pdf"
            onClick={() => downloadReport(result)}
            disabled={!hasReport(result)}
            title={
              hasReport(result)
                ? 'Download the investigation report generated by the service'
                : 'This trace has no report to export'
            }
          >
            <Download size={14} aria-hidden />
            Export report
          </button>
        </div>
      </div>
    </>
  );
}

/**
 * The ML intelligence card: every model output the service attached to this trace.
 *
 * VASP attribution (known or inferred) with its confidence and SHAP-backed reasons,
 * unlabelled look-alikes the model propagated a label to, heuristic clusters, and
 * layering signals. When the Python ML service was unreachable the DTO carries no
 * `ml` — the card says so and how to enable it, instead of silently showing a
 * rule-only case as if that were the whole product.
 */
function MlIntelligence({
  ml,
  status,
  servedFromCache,
}: {
  ml: TraceResult['ml'];
  status: TraceResult['status'];
  servedFromCache: TraceResult['servedFromCache'];
}) {
  // A failed trace owns the error banner; an "ML offline" note here would bury the lead.
  if ((status || '').toLowerCase() === 'failed') return null;

  if (!ml) {
    return (
      <div className="glass-panel card-section">
        <div className="card-header">
          <h3 className="card-title">ML intelligence</h3>
          <span className="tagline">offline</span>
        </div>
        <p className="disclosure__note" style={{ margin: 0 }}>
          {servedFromCache ? (
            <>
              This result was replayed from cache, which carries no model scoring. Run
              the investigation again for a fresh ML-scored trace.
            </>
          ) : (
            <>
              The ML service (exchange-likelihood, clustering, layering) did not score
              this trace. Run <code>uvicorn main:app --port 8000</code> in{' '}
              <code>backend/ml-service</code> and set{' '}
              <code>ML_URL=http://127.0.0.1:8000</code> to enable it.
            </>
          )}
        </p>
      </div>
    );
  }

  const vasp = ml.vasp ?? null;
  const alternatives = ml.alternatives ?? [];
  const propagated = ml.propagated ?? [];
  const layering = ml.layering ?? [];
  const clusters = Object.entries(ml.clusters ?? {});
  const anomalies = ml.anomalies ?? [];
  const suspectedMixers = ml.suspectedMixers ?? [];
  const empty =
    !vasp &&
    alternatives.length === 0 &&
    propagated.length === 0 &&
    layering.length === 0 &&
    clusters.length === 0 &&
    anomalies.length === 0 &&
    suspectedMixers.length === 0;

  return (
    <div className="glass-panel card-section">
      <div className="card-header">
        <h3 className="card-title">ML intelligence</h3>
        <span className="tagline">model-scored</span>
      </div>

      {empty ? (
        <p className="disclosure__note" style={{ margin: 0 }}>
          The model scored this trace and fired no signals — no VASP candidate, no
          look-alike addresses, no clusters, no layering patterns.
        </p>
      ) : null}

      {vasp ? (
        <>
          <span className="card-label">Likely cash-out point</span>
          <div className="briefing__row">
            <span>{shortenAddress(vasp.address)}</span>
            <span className="briefing__conf">
              <span className="briefing__conf-num">{(vasp.confidence * 100).toFixed(1)}%</span>
              <span className="briefing__conf-cap">{vasp.basis === 'known_label' ? 'labelled' : 'inferred'}</span>
            </span>
          </div>
          <p className="disclosure__note" style={{ margin: '6px 0 0' }}>
            {vasp.hops} hop{vasp.hops === 1 ? '' : 's'} from the reported wallet · received {vasp.received}
          </p>
          {vasp.reasons.length > 0 ? (
            <ul className="risk-factors" style={{ listStyle: 'none', margin: '8px 0 0', padding: 0 }}>
              {vasp.reasons.map((reason, i) => (
                <li key={i} className="risk-factor">
                  <span className="risk-factor__name">{reason}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </>
      ) : null}

      {alternatives.length > 0 ? (
        <>
          <span className="card-label">Other candidates</span>
          <ul className="risk-factors" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {alternatives.map((alt) => (
              <li key={alt.address} className="risk-factor">
                <span className="risk-factor__name">
                  {shortenAddress(alt.address)} · {(alt.confidence * 100).toFixed(1)}% · {alt.hops} hop{alt.hops === 1 ? '' : 's'}
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {propagated.length > 0 ? (
        <>
          <span className="card-label">Look-alike addresses ({propagated.length})</span>
          <ul className="risk-factors" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {propagated.map((p) => (
              <li key={p.address} className="risk-factor">
                <span className="risk-factor__name">
                  {shortenAddress(p.address)} · {(p.similarity * 100).toFixed(1)}% like {shortenAddress(p.like)} ({p.basis})
                  {p.reasons[0] ? <span style={{ display: 'block', opacity: 0.75 }}>{p.reasons[0]}</span> : null}
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {!ml.anomalyAvailable ? (
        <p className="disclosure__note" style={{ margin: '8px 0 0' }}>
          Too few addresses in this trace for anomaly scoring (Isolation Forest needs
          8+). Structural layering rules above still apply.
        </p>
      ) : anomalies.length > 0 ? (
        <>
          <span className="card-label">Anomalous addresses ({anomalies.length})</span>
          <ul className="risk-factors" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {anomalies.map((a) => (
              <li key={a.address} className="risk-factor">
                <span className="risk-factor__name">
                  {shortenAddress(a.address)} · anomaly {(a.anomaly * 100).toFixed(0)}%
                  {a.flags.length > 0 ? <span style={{ display: 'block', opacity: 0.75 }}>{a.flags.join(', ')}</span> : null}
                </span>
              </li>
            ))}
          </ul>
          <p className="disclosure__note" style={{ margin: '6px 0 0' }}>
            Unsupervised outliers relative to this trace — no labelled fraud data used.
          </p>
        </>
      ) : null}

      {suspectedMixers.length > 0 ? (
        <>
          <span className="card-label">Suspected mixers ({suspectedMixers.length})</span>
          <ul className="risk-factors" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {suspectedMixers.map((s) => (
              <li key={s.address} className="risk-factor">
                <span className="risk-factor__name">
                  {shortenAddress(s.address)} · {(s.mixerProb * 100).toFixed(1)}% mixer
                  {s.reasons[0] ? <span style={{ display: 'block', opacity: 0.75 }}>{s.reasons[0]}</span> : null}
                </span>
              </li>
            ))}
          </ul>
          <p className="disclosure__note" style={{ margin: '6px 0 0' }}>
            Behavioural call, not a registry hit — these nodes are labelled MIXER in the
            graph with the model confidence.
          </p>
        </>
      ) : null}

      {clusters.length > 0 ? (
        <>
          <span className="card-label">Clusters ({clusters.length})</span>
          <ul className="risk-factors" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {clusters.map(([key, members]) => (
              <li key={key} className="risk-factor">
                <span className="risk-factor__name">
                  {key} · {members.length} member{members.length === 1 ? '' : 's'}
                  {members.length > 0 ? (
                    <span style={{ display: 'block', opacity: 0.75 }}>
                      {members.slice(0, 4).map(shortenAddress).join(', ')}
                      {members.length > 4 ? ` +${members.length - 4} more` : ''}
                    </span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {layering.length > 0 ? (
        <>
          <span className="card-label">Layering signals ({layering.length})</span>
          <ul className="risk-factors" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {layering.map((pattern, i) => (
              <li key={`${pattern.type}-${i}`} className="risk-factor">
                <span className="risk-factor__name">
                  {pattern.type} — {pattern.detail}
                  {typeof pattern.max_anomaly === 'number' && pattern.max_anomaly > 0 ? (
                    <span style={{ display: 'block', opacity: 0.75 }}>
                      peak anomaly {(pattern.max_anomaly * 100).toFixed(0)}%
                    </span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {ml.note ? (
        <p className="disclosure__note" style={{ marginBottom: 0 }}>
          {ml.note}
        </p>
      ) : null}
    </div>
  );
}

/** The sentinel the backend stores when no weighted rule fires. */
const NO_SIGNALS = 'No high-risk patterns detected';

function firedSignals(patterns: string | null | undefined): string[] {
  return splitPatterns(patterns).filter((p) => p !== NO_SIGNALS);
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="fact-box">
      <span className="fact-value">{value}</span>
      <span className="fact-label">{label}</span>
    </div>
  );
}
