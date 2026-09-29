import { DEMO_REPORT } from '../../lib/demo';
import { shortenAddress } from '../../format';
import SectionEyebrow from '../common/SectionEyebrow';
import { Reveal, RevealGroup, RevealItem } from '../common/Reveal';
import IllustrativeTag from '../common/IllustrativeTag';

/**
 * 11 — REPORTING
 *
 * The report is the deliverable, so it is shown as a document rather than described.
 * The fields mirror `ReportService` field for field, which is why the preview can be
 * trusted to match what the product actually produces.
 */

const STAGES = [
  {
    name: 'Findings are written, not templated',
    text: 'Each finding names the address, the hop, the entity it resolved to, the confidence, and the risk weight it contributed.',
  },
  {
    name: 'Every row keeps its provenance',
    text: 'Address, counterparty, amount, asset and block height travel together, so a reader can re-derive the sequence independently.',
  },
  {
    name: 'The case is exportable',
    text: 'The backend renders a structured report document from the same data the workspace displays. No re-keying, no screenshots.',
  },
] as const;

export default function ReportSection() {
  const r = DEMO_REPORT;

  return (
    <section className="section" id="reporting" aria-labelledby="report-title">
      <div className="container report__layout">
        <Reveal>
          <SectionEyebrow index="11">Reporting</SectionEyebrow>
          <h2 id="report-title" className="section-title">
            The output is a case, not a chart.
          </h2>
          <p className="lead">
            An investigation has to leave the tool in a form someone else can act on.
            That is a structured record with findings, provenance and a stated risk
            basis — not a graph someone screenshots into a slide.
          </p>

          <RevealGroup className="report__pipeline" step={0.12}>
            {STAGES.map((stage, i) => (
              <RevealItem key={stage.name} className={`report__stage report__stage--on`}>
                <span className="report__stage-node" aria-hidden />
                <span className="report__stage-name">
                  {String(i + 1).padStart(2, '0')} · {stage.name}
                </span>
                <span className="report__stage-text">{stage.text}</span>
              </RevealItem>
            ))}
          </RevealGroup>
        </Reveal>

        <Reveal delay={0.1}>
          <div className="report__doc">
            <div className="report__doc-head">
              <span className="report__doc-title">Investigation report</span>
              <span className="report__doc-gen">{r.generated}</span>
            </div>

            <div className="report__doc-grid">
              <span className="report__doc-key">Case</span>
              <span className="report__doc-val">{r.caseId}</span>
              <span className="report__doc-key">Trace</span>
              <span className="report__doc-val">{r.traceId}</span>
              <span className="report__doc-key">Chain</span>
              <span className="report__doc-val">{r.chain}</span>
              <span className="report__doc-key">Wallet</span>
              <span className="report__doc-val">{shortenAddress(r.wallet)}</span>
              <span className="report__doc-key">Status</span>
              <span className="report__doc-val">{r.status}</span>
              <span className="report__doc-key">Coverage</span>
              <span className="report__doc-val">
                {r.hops} hops · {r.addresses} addresses · {r.transfers} transfers
              </span>
              <span className="report__doc-key">Risk</span>
              <span className="report__doc-val" style={{ color: '#b4231f' }}>
                {r.risk}
              </span>
            </div>

            <div className="report__doc-section">
              <span className="report__doc-h">Key transfers</span>
              {r.rows.map((row) => (
                <span key={row.join()} className="report__doc-row">
                  <span>{row[0]}</span>
                  <span>{row[1]}</span>
                  <span style={{ textAlign: 'right' }}>{row[2]}</span>
                </span>
              ))}
            </div>

            <div className="report__doc-section">
              <span className="report__doc-h">Findings</span>
              {Array.from({ length: 5 }).map((_, i) => (
                <span
                  key={i}
                  className="report__doc-line"
                  style={{ width: `${100 - i * 9}%` }}
                />
              ))}
            </div>

            <p className="report__doc-foot">
              Risk indicators are triage signals derived from on-chain behaviour. They
              are not a determination of wrongdoing. Verify independently before
              relying on this report.
            </p>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
            <IllustrativeTag />
          </div>
        </Reveal>
      </div>
    </section>
  );
}
