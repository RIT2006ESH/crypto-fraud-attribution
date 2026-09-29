import { motion, useReducedMotion } from 'framer-motion';
import { PROBLEM_CHALLENGES } from '../../lib/demo';
import { EASE } from '../../lib/motion';
import SectionEyebrow from '../common/SectionEyebrow';
import { Reveal, RevealGroup, RevealItem } from '../common/Reveal';

/**
 * 03 — PROBLEM
 *
 * One editorial statement, then three challenges that state a real obstacle in
 * investigative work. Each carries a small diagram of the shape of the problem —
 * fragmentation, an unlabelled address, a wide graph — rather than an illustration.
 */

export default function ProblemSection() {
  const reduce = useReducedMotion();

  return (
    <section className="section" id="problem" aria-labelledby="problem-title">
      <div className="container">
        <Reveal className="section-head">
          <SectionEyebrow index="03">The problem</SectionEyebrow>
          <h2 id="problem-title" className="problem__statement">
            Crypto moves fast. Investigations cannot depend on{' '}
            <em>fragmented evidence.</em>
          </h2>
          <p className="lead">
            A report arrives as an address. What matters is everything that address
            touched, what those addresses turned out to be, and which of them warrant a
            closer look. That record does not exist anywhere as a single artefact.
          </p>
        </Reveal>

        <div className="problem__grid">
          {reduce ? null : (
            <motion.span
              className="problem__spine"
              aria-hidden
              initial={{ scaleX: 0 }}
              whileInView={{ scaleX: 1 }}
              viewport={{ once: true, amount: 0.6 }}
              transition={{ duration: 1.1, ease: EASE.inOut }}
              style={{ width: '100%' }}
            />
          )}

          <RevealGroup className="problem__grid-inner" step={0.13} as="div">
            {PROBLEM_CHALLENGES.map((challenge, index) => (
              <RevealItem key={challenge.num} className="problem__cell">
                <span className="problem__num">{challenge.num}</span>
                <h3 className="problem__title">{challenge.title}</h3>
                <p className="problem__body">{challenge.body}</p>
                <ChallengeDiagram index={index} />
              </RevealItem>
            ))}
          </RevealGroup>
        </div>
      </div>
    </section>
  );
}

/** Three tiny diagrams, one per challenge. Drawn, not stocked. */
function ChallengeDiagram({ index }: { index: number }) {
  const reduce = useReducedMotion();
  const delay = 0.25 + index * 0.1;

  if (index === 0) {
    // Fragmented: one source fanning into scattered records.
    return (
      <svg className="problem__viz" viewBox="0 0 240 62" aria-hidden>
        <circle cx="16" cy="31" r="5" fill="var(--entity-target)" />
        {[
          { x: 92, y: 12 },
          { x: 104, y: 31 },
          { x: 92, y: 50 },
        ].map((p, i) => (
          <g key={i}>
            <motion.path
              d={`M 22 31 Q ${p.x / 1.6} ${(31 + p.y) / 2} ${p.x - 6} ${p.y}`}
              fill="none"
              stroke="var(--edge-native)"
              strokeWidth={1}
              initial={reduce ? undefined : { pathLength: 0 }}
              whileInView={reduce ? undefined : { pathLength: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, delay: delay + i * 0.12, ease: EASE.inOut }}
            />
            <motion.circle
              cx={p.x}
              cy={p.y}
              r={4}
              fill="none"
              stroke="var(--entity-wallet)"
              strokeWidth={1.2}
              initial={reduce ? undefined : { opacity: 0 }}
              whileInView={reduce ? undefined : { opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: delay + 0.4 + i * 0.12 }}
            />
          </g>
        ))}
        {[
          { x: 168, y: 16 },
          { x: 176, y: 34 },
          { x: 168, y: 48 },
        ].map((p, i) => (
          <motion.rect
            key={`r-${i}`}
            x={p.x}
            y={p.y - 7}
            width={54}
            height={14}
            rx={3}
            fill="none"
            stroke="var(--surface-hairline-strong)"
            strokeWidth={1}
            initial={reduce ? undefined : { opacity: 0, x: -6 }}
            whileInView={reduce ? undefined : { opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: delay + 0.7 + i * 0.1 }}
          />
        ))}
      </svg>
    );
  }

  if (index === 1) {
    // Unknown entity: an address resolving, or failing to resolve.
    return (
      <svg className="problem__viz" viewBox="0 0 240 62" aria-hidden>
        <motion.text
          x="14"
          y="27"
          style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fill: 'var(--text-muted)' }}
          initial={reduce ? undefined : { opacity: 0 }}
          whileInView={reduce ? undefined : { opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay }}
        >
          0x7c1d55fe…
        </motion.text>
        <motion.line
          x1="90"
          y1="22"
          x2="150"
          y2="22"
          stroke="var(--surface-hairline-strong)"
          strokeWidth={1}
          strokeDasharray="3 3"
          initial={reduce ? undefined : { pathLength: 0 }}
          whileInView={reduce ? undefined : { pathLength: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: delay + 0.15 }}
        />
        <motion.g
          initial={reduce ? undefined : { opacity: 0, scale: 0.7 }}
          whileInView={reduce ? undefined : { opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: delay + 0.6, ease: EASE.soft }}
          style={{ transformOrigin: '196px 22px' }}
        >
          <circle cx="196" cy="22" r="9" fill="none" stroke="var(--entity-unlabelled)" strokeWidth={1.4} />
          <text
            x="196"
            y="49"
            textAnchor="middle"
            style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fill: 'var(--text-faint)' }}
          >
            ?
          </text>
        </motion.g>
        <motion.rect
          x="14"
          y="42"
          width="96"
          height="14"
          rx="3"
          fill="none"
          stroke="var(--surface-hairline)"
          strokeWidth={1}
          initial={reduce ? undefined : { opacity: 0 }}
          whileInView={reduce ? undefined : { opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: delay + 0.4 }}
        />
      </svg>
    );
  }

  // Complex flow: the relevant path buried inside a wide graph.
  return (
    <svg className="problem__viz" viewBox="0 0 240 62" aria-hidden>
      {Array.from({ length: 11 }).map((_, i) => {
        const x = 16 + (i % 6) * 30;
        const y = i < 6 ? 16 : 46;
        return (
          <circle
            key={i}
            cx={x}
            cy={y}
            r={3}
            fill="none"
            stroke="var(--entity-wallet)"
            strokeWidth={1}
            strokeOpacity={0.55}
          />
        );
      })}
      <motion.path
        d="M 16 16 L 46 16 L 76 46 L 106 46 L 136 16 L 166 16"
        fill="none"
        stroke="var(--accent-primary)"
        strokeWidth={1.4}
        initial={reduce ? undefined : { pathLength: 0, opacity: 0 }}
        whileInView={reduce ? undefined : { pathLength: 1, opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 1, delay: delay + 0.3, ease: EASE.inOut }}
      />
      <motion.circle
        cx={16}
        cy={16}
        r={5}
        fill="var(--accent-primary)"
        initial={reduce ? undefined : { scale: 0 }}
        whileInView={reduce ? undefined : { scale: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.4, delay: delay + 0.2 }}
      />
    </svg>
  );
}
