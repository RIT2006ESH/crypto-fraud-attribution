import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, Download, ShieldQuestion, TriangleAlert } from 'lucide-react';
import type { TraceResult } from '../../types';
import { entityMeta } from '../../lib/entities';
import { capScore, categorize, riskColor, RISK_RULES, isRealSignal } from '../../lib/risk';
import { chainMeta } from '../../lib/chains';
import { hasReport, splitPatterns } from '../../api';
import { downloadReport } from '../../lib/report';
import { shortenAddress } from '../../format';
import { prefersReducedMotion } from '../../lib/graph/fit';
import { RiskDial } from '../marketing/scenes/RiskDial';

interface Props {
  result: TraceResult;
  elapsedMs: number | null;
}

/**
 * The intelligence briefing.
 *
 * This is the rail's job once a trace has landed: answer "what should I know before I
 * inspect the graph?" in the order an investigator asks it — what is this, how did it
 * get attributed, how risky is it, what specifically fired, and what the record is
 * missing. The report export is last because it is the outcome, not the entry point.
 *
 * Every number here comes from the DTO. The service sent no attribution, so the panel
 * says so; it sent a 95% confidence, so the panel shows 95%. Nothing is estimated,
 * rounded up, or filled in with a plausible-looking placeholder.
 */
export default function IntelligenceBriefing({ result, elapsedMs }: Props) {
  const [openWhy, setOpenWhy] = useState<null | 'attribution' | 'risk'>(null);

  const address = (result.walletAddress || '').toLowerCase();
  const rootNode = result.nodes?.find((n) => n.address?.toLowerCase() === address);
  const labelType = rootNode?.labelType ?? null;
  const meta = entityMeta(labelType);

  const rawScore = typeof result.riskScore === 'number' ? result.riskScore : null;
  const score = rawScore === null ? null : capScore(rawScore);
  const category = result.riskCategory ?? (score === null ? null : categorize(score));
  const color = riskColor(category);

  const hops = result.hopsTraced ?? result.nodes?.reduce((m, n) => Math.max(m, n.hopDepth ?? 0), 0) ?? 0;
  const nodeCount = result.nodes?.length ?? 0;
  const transferCount = result.edges?.length ?? 0;
  const patterns = splitPatterns(result.flaggedPatterns).filter(isRealSignal);
  const limitations = result.limitations ?? [];
  const sources = result.provenance?.sources ?? [];

  const attribution = result.attribution ?? null;
  const keyPaths = result.findings?.keyPaths ?? [];

  return (
    <div className="briefing-stack">
      {/* ── Case summary ─────────────────────────────────────────────── */}
      <section className="rail-section" aria-labelledby="case-summary-heading">
        <h3 className="rail-heading" id="case-summary-heading">Case summary</h3>
        <div className="rail-kv">
          <span className="rail-kv__k">Target</span>
          <code className="rail-kv__v is-mono">{shortenAddress(address)}</code>
        </div>
        <div className="rail-kv">
          <span className="rail-kv__k">Chain</span>
          <span className="rail-kv__v">{chainMeta(result.chain).label}</span>
        </div>
        <div className="rail-kv">
          <span className="rail-kv__k">Status</span>
          <span className="rail-kv__v">{result.status || 'COMPLETED'}</span>
        </div>
      </section>

      {/* ── Intelligence briefing ─────────────────────────────────────── */}
      <section className="rail-section" aria-labelledby="briefing-heading">
        <h3 className="rail-heading" id="briefing-heading">Intelligence briefing</h3>

        <div className="attribution-block">
          <span className="field-label">Primary attribution</span>
          {attribution ? (
            <>
              <span className="attribution-entity">
                {attribution.primary.entity ?? 'Known exchange address'}
              </span>
              <span className="attribution-type">
                Exchange / VASP · {attribution.primary.hopDepth} hop
                {attribution.primary.hopDepth === 1 ? '' : 's'} from target
              </span>
            </>
          ) : (
            <span className="attribution-entity attribution-entity--none">None reached</span>
          )}
        </div>

        {attribution ? (
          <div className="confidence-block">
            <span className="field-label">Attribution confidence</span>
            <div className="confidence-block__row">
              <span className="confidence-block__value is-mono">
                {Math.round(attribution.confidence.score)}%
              </span>
              <span className="confidence-block__level">{attribution.confidence.level}</span>
            </div>
            <div className="confidence-bar" role="img" aria-label={`Attribution confidence ${attribution.confidence.score} percent`}>
              <span style={{ width: `${Math.max(0, Math.min(100, attribution.confidence.score))}%` }} />
            </div>
            <p className="field-note">
              Reported by the service for this trace. It reflects the presence of a direct link to
              a known exchange, not the likelihood of wrongdoing.
            </p>
          </div>
        ) : null}

        <div className="attribution-block">
          <span className="field-label">Target label</span>
          <span className="attribution-entity" style={{ color: meta.color }}>
            {labelType ? meta.label : 'Unlabelled wallet'}
          </span>
          {rootNode?.labelConfidence != null ? (
            <span className="attribution-type">
              {Math.round(rootNode.labelConfidence * 100)}% label confidence
            </span>
          ) : null}
        </div>
      </section>

      {/* ── Risk ──────────────────────────────────────────────────────── */}
      <section className="rail-section" aria-labelledby="risk-heading">
        <h3 className="rail-heading" id="risk-heading">Risk assessment</h3>
        {score === null ? (
          <p className="field-note">The service returned no risk score for this trace.</p>
        ) : (
          <>
            <div className="risk-block">
              <RiskDial score={score} color={color} size="sm" />
              <div className="risk-block__meta">
                <span className="risk-block__value is-mono" style={{ color }}>
                  {score} / 100
                </span>
                <span className="risk-block__category" style={{ color }}>
                  {category}
                </span>
                <span className="risk-block__signals">
                  {patterns.length} signal{patterns.length === 1 ? '' : 's'}
                </span>
              </div>
            </div>

            {patterns.length > 0 ? (
              <ul className="signal-list">
                {patterns.map((p) => {
                  const rule = RISK_RULES.find((r) => p.startsWith(r.name));
                  return (
                    <li key={p} className="signal-item">
                      <span className="signal-item__dot" style={{ background: color }} aria-hidden />
                      <span className="signal-item__text">{p}</span>
                      {rule ? <span className="signal-item__points is-mono">+{rule.weight}</span> : null}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="field-note">
                No weighted risk rule fired on this trace. A zero score is not an all-clear: it
                means nothing observable in the traced subgraph triggered a rule.
              </p>
            )}
          </>
        )}
      </section>

      {/* ── Key findings ──────────────────────────────────────────────── */}
      <section className="rail-section" aria-labelledby="findings-heading">
        <h3 className="rail-heading" id="findings-heading">Key findings</h3>
        {result.findings?.summary ? (
          <p className="findings-summary">{result.findings.summary}</p>
        ) : null}
        <ul className="findings-list">
          {keyPaths.map((p) => (
            <li key={p.pathId} className="finding-item">
              <span className="finding-item__badge">Path</span>
              <span className="finding-item__text">
                {p.significance} — {p.hops} hop{p.hops === 1 ? '' : 's'}
              </span>
            </li>
          ))}
          {hops > 0 ? (
            <li className="finding-item">
              <span className="finding-item__badge">Depth</span>
              <span className="finding-item__text">
                Traced {hops} hop{hops === 1 ? '' : 's'} outward
              </span>
            </li>
          ) : null}
          {transferCount > 0 ? (
            <li className="finding-item">
              <span className="finding-item__badge">Volume</span>
              <span className="finding-item__text">
                {transferCount} transfer{transferCount === 1 ? '' : 's'} across {nodeCount} address
                {nodeCount === 1 ? '' : 'es'}
              </span>
            </li>
          ) : null}
          {sources.length > 0 ? (
            <li className="finding-item">
              <span className="finding-item__badge">Source</span>
              <span className="finding-item__text">
                {sources.map((s) => s.provider).join(', ')}
                {result.servedFromCache ? ' (served from cache)' : ''}
              </span>
            </li>
          ) : null}
        </ul>

        {limitations.length > 0 ? (
          <div className="limitation-block">
            <span className="field-label">
              <TriangleAlert size={11} aria-hidden /> Limitations
            </span>
            <ul>
              {limitations.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
            <p className="field-note">
              A result bounded by limits is evidence within those limits. It is not a complete history
              of the address.
            </p>
          </div>
        ) : null}
      </section>

      {/* ── Explainers ────────────────────────────────────────────────── */}
      <section className="rail-section" aria-labelledby="explain-heading">
        <h3 className="rail-heading" id="explain-heading">Why this attribution?</h3>
        <Disclosure
          id="attribution"
          openState={openWhy === 'attribution'}
          onToggle={() => setOpenWhy(openWhy === 'attribution' ? null : 'attribution')}
          summary="Why this attribution?"
        >
          {attribution ? (
            <>
              <p className="field-note">
                The service resolved a known exchange address{' '}
                {attribution.primary.hopDepth} hop{attribution.primary.hopDepth === 1 ? '' : 's'} from
                the reported wallet.
              </p>
              <ul className="reason-list">
                {attribution.confidence.reasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
              <p className="field-note">
                A cash-out point tells you where funds can leave the traced system. It is not by
                itself evidence of a crime, and the address may hold activity for many users.
              </p>
            </>
          ) : (
            <p className="field-note">
              This trace reached no exchange or other known entity, so the service returned no
              attribution. Every address in it is unlabelled — which is a statement about public
              knowledge, not about the wallet.
            </p>
          )}
        </Disclosure>

        <Disclosure
          id="risk"
          openState={openWhy === 'risk'}
          onToggle={() => setOpenWhy(openWhy === 'risk' ? null : 'risk')}
          summary="Why this risk?"
        >
          <p className="field-note">
            The score is the sum of weighted rules that fired on the traced subgraph. Bands: low below
            25, medium 25–49, high 50–74, critical at 75 and above.
          </p>
          <ul className="reason-list">
            {RISK_RULES.map((r) => (
              <li key={r.name} className={patterns.some((p) => p.startsWith(r.name)) ? 'is-fired' : undefined}>
                {r.name} <span className="is-mono">+{r.weight}</span>
              </li>
            ))}
          </ul>
          <p className="field-note">
            A high category means indicators fired. It does not establish intent, and it says
            nothing about activity outside the traced depth.
          </p>
        </Disclosure>
      </section>

      {/* ── Report ────────────────────────────────────────────────────── */}
      <section className="rail-section" aria-labelledby="report-heading">
        <h3 className="rail-heading" id="report-heading">Report</h3>
        {hasReport(result) ? (
          <>
            <button
              type="button"
              className="btn btn--primary btn--block"
              onClick={() => downloadReport(result)}
            >
              <Download size={13} aria-hidden />
              Export PDF
            </button>
            <p className="field-note">
              The report carries the case reference, the trace record, the findings and the
              limitations. {elapsedMs ? `Assembled in ${(elapsedMs / 1000).toFixed(1)}s.` : ''}
            </p>
          </>
        ) : (
          <p className="field-note">
            <ShieldQuestion size={11} aria-hidden /> No report is available for this trace.
          </p>
        )}
      </section>
    </div>
  );
}

/** A small expandable. Kept here rather than a library: it is four lines of behaviour. */
function Disclosure({
  summary,
  openState,
  onToggle,
  children,
}: {
  id: string;
  summary: string;
  openState: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  const reduced = prefersReducedMotion();
  return (
    <div className={`disclosure${openState ? ' disclosure--open' : ''}`}>
      <button
        type="button"
        className="disclosure__trigger"
        onClick={onToggle}
        aria-expanded={openState}
      >
        {summary}
        <ChevronDown size={13} aria-hidden className="disclosure__chevron" />
      </button>
      <AnimatePresence initial={false}>
        {openState ? (
          <motion.div
            className="disclosure__panel"
            initial={reduced ? false : { height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={reduced ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: reduced ? 0 : 0.22, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="disclosure__body">{children}</div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
