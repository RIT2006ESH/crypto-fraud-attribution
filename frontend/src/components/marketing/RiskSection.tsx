import { Info } from 'lucide-react';
import { DEMO_RISK_EXAMPLE } from '../../lib/demo';
import { RISK_RULES, capScore, riskColor } from '../../lib/risk';
import SectionEyebrow from '../common/SectionEyebrow';
import { Reveal } from '../common/Reveal';
import { RiskDial } from './scenes/RiskDial';
import IllustrativeTag from '../common/IllustrativeTag';

/**
 * 08 — RISK
 *
 * The score is shown as arithmetic, not as an oracle. Each factor names the signal
 * that triggered it, shows the weight it carries, and points at the address that
 * triggered it. The raw total is displayed alongside the capped score because
 * hiding the cap would misrepresent the model.
 */

export default function RiskSection() {
  const { score, rawScore, category, factors, notFired } = DEMO_RISK_EXAMPLE;
  const color = riskColor(category);
  const maxWeight = Math.max(...factors.map((f) => f.contribution));

  return (
    <section className="section" id="risk" aria-labelledby="risk-title">
      <div className="container risk__layout">
        <Reveal>
          <SectionEyebrow index="08">Risk</SectionEyebrow>
          <h2 id="risk-title" className="section-title">
            A score you can take apart.
          </h2>
          <p className="lead">
            Seven weighted rules run over the traced graph. Each one fires on a signal
            that is visible in the trace, each one carries a published weight, and the
            total is capped at 100. Nothing is added without a reason.
          </p>

          <div className="risk__note" style={{ marginTop: 26 }}>
            <Info size={15} aria-hidden />
            <span>
              A high score indicates <strong>suspicious activity and risk indicators</strong>.
              It is a triage aid, not a determination of wrongdoing. Always verify the
              underlying on-chain evidence before acting.
            </span>
          </div>
        </Reveal>

        <Reveal delay={0.1} className="risk__card">
          <div className="risk__headline">
            <RiskDial score={score} color={color} />
            <div className="risk__headline-meta">
              <span className="risk__headline-cat" style={{ color }}>
                {category}
              </span>
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 'var(--fs-meta)',
                  color: 'var(--text-faint)',
                }}
              >
                {rawScore} raw → {capScore(rawScore)} capped
              </span>
              <IllustrativeTag />
            </div>
          </div>

          <div className="risk__factors">
            {factors.map((factor) => {
              const rule = RISK_RULES.find((r) => r.id === factor.ruleId);
              return (
                <div key={factor.ruleId} className="risk__factor">
                  <span className="risk__factor-name">
                    <span
                      aria-hidden
                      style={{
                        width: 5,
                        height: 5,
                        borderRadius: '50%',
                        background: color,
                        flexShrink: 0,
                      }}
                    />
                    <span>
                      {rule?.name ?? factor.ruleId}
                      <span
                        style={{
                          display: 'block',
                          fontFamily: 'var(--font-mono)',
                          fontSize: 'var(--fs-micro)',
                          color: 'var(--text-faint)',
                          marginTop: 2,
                        }}
                      >
                        {factor.evidence}
                      </span>
                    </span>
                  </span>
                  <span className="risk__factor-bar">
                    <span
                      className="risk__factor-fill"
                      style={{
                        display: 'block',
                        width: `${(factor.contribution / maxWeight) * 100}%`,
                        background: color,
                      }}
                    />
                  </span>
                  <span className="risk__factor-value">+{factor.contribution}</span>
                </div>
              );
            })}
          </div>

          {notFired.length > 0 ? (
            <div className="risk__note">
              <Info size={15} aria-hidden />
              <span>
                {notFired.length} rule{notFired.length > 1 ? 's' : ''} evaluated and did{' '}
                {notFired.length > 1 ? 'do' : ''} not fire:{' '}
                {notFired
                  .map((r) => `${RISK_RULES.find((x) => x.id === r.ruleId)?.name ?? r.ruleId} (${r.reason})`)
                  .join('; ')}
                .
              </span>
            </div>
          ) : null}
        </Reveal>
      </div>
    </section>
  );
}
