import { motion, useReducedMotion } from 'framer-motion';
import { ArrowDown, Database, FileSearch, Link2, Tag } from 'lucide-react';
import { ATTRIBUTION_PIPELINE, DEMO_ATTRIBUTION } from '../../lib/demo';
import { EASE } from '../../lib/motion';
import SectionEyebrow from '../common/SectionEyebrow';
import { Reveal } from '../common/Reveal';
import IllustrativeTag from '../common/IllustrativeTag';

/**
 * 07 — ATTRIBUTION
 *
 * Four stages, descending, each one narrowing what the previous one left open: the
 * address, then the entity it resolved to, then how confident that is, then where
 * the answer came from. The order is not ours — it is the resolution order in
 * `LabelService`, where the first hit wins.
 */

const ICONS = [Tag, Link2, Database, FileSearch];

export default function AttributionSection() {
  const reduce = useReducedMotion();
  const { pipeline, confidence } = DEMO_ATTRIBUTION;

  return (
    <section className="section" id="attribution" aria-labelledby="attr-title">
      <div className="container attr__layout">
        <Reveal>
          <SectionEyebrow index="07">Attribution</SectionEyebrow>
          <h2 id="attr-title" className="section-title">
            Every label arrives with its confidence and its source.
          </h2>
          <p className="lead">
            An address on its own says nothing. What matters is what it resolved to, how
            sure the system is, and which of four resolution steps produced the answer.
            Addresses that resolve to nothing stay marked unlabelled rather than being
            guessed at.
          </p>

          <div className="attr__source-list">
            {ATTRIBUTION_PIPELINE.map((item) => (
              <span key={item.order} className="attr__source">
                <span className="attr__source-index">{item.order}</span>
                <span style={{ color: 'var(--text-secondary)' }}>{item.name}</span>
                <span style={{ color: 'var(--text-faint)' }}>— {item.strength}</span>
              </span>
            ))}
          </div>
        </Reveal>

        <Reveal delay={0.1} className="attr__descend">
          {pipeline.map((stage, i) => {
            const Icon = ICONS[i] ?? Tag;
            const isEntity = i === 1;
            const isConfidence = i === 2;
            return (
              <motion.div
                key={stage.step}
                className="attr__stage"
                initial={reduce ? undefined : { opacity: 0, y: 14 }}
                whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.4 }}
                transition={{ duration: 0.5, delay: i * 0.12, ease: EASE.soft }}
              >
                <span className="attr__stage-label">
                  <Icon size={13} aria-hidden style={{ verticalAlign: '-2px', marginRight: 7 }} />
                  {stage.step}
                </span>

                <div className="attr__stage-value">
                  <span className={`attr__stage-primary${isEntity ? ' attr__stage-primary--entity' : ''}`}>
                    {stage.value}
                  </span>
                  <span className="attr__stage-sub">{stage.note}</span>
                </div>

                {isConfidence ? (
                  <div className="attr__stage-gauge">
                    <div className="attr__conf">
                      {(confidence / 100).toFixed(2)}
                    </div>
                    <div className="attr__conf-bar">
                      <motion.div
                        className="attr__conf-fill"
                        initial={reduce ? undefined : { scaleX: 0 }}
                        whileInView={reduce ? undefined : { scaleX: confidence / 100 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.8, ease: EASE.inOut }}
                        style={{ transformOrigin: 'left', width: '100%' }}
                      />
                    </div>
                  </div>
                ) : null}

                {i < pipeline.length - 1 ? (
                  <span className="attr__connector" aria-hidden>
                    <ArrowDown size={11} style={{ color: 'var(--surface-hairline-strong)' }} />
                  </span>
                ) : null}
              </motion.div>
            );
          })}

          <div
            style={{
              padding: '11px 18px',
              borderTop: '1px solid var(--surface-hairline-soft)',
              display: 'flex',
              justifyContent: 'flex-end',
            }}
          >
            <IllustrativeTag />
          </div>
        </Reveal>
      </div>
    </section>
  );
}
