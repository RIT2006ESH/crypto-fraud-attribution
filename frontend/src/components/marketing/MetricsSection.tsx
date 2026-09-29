import { CAPABILITY_METRICS } from '../../lib/demo';
import { useCountUp } from '../../lib/motion';
import { RevealGroup, RevealItem } from '../common/Reveal';

/**
 * 12 — CAPABILITY METRICS
 *
 * Four numbers, all of them countable from the codebase: two supported chains, four
 * graph view modes, seven weighted risk rules, four attribution steps. Nothing here
 * is a market claim, which is why none of it is presented as one.
 */

export default function MetricsSection() {
  return (
    <section className="section" aria-label="Capabilities">
      <div className="container">
        <RevealGroup className="metrics__grid" step={0.09}>
          {CAPABILITY_METRICS.map((metric) => (
            <Metric key={metric.name} {...metric} />
          ))}
        </RevealGroup>
      </div>
    </section>
  );
}

function Metric({ value, name, text }: (typeof CAPABILITY_METRICS)[number]) {
  const { ref, display } = useCountUp(value);

  return (
    <RevealItem className="metrics__cell" variant="fadeIn">
      <span className="metrics__value" ref={ref}>
        {display}
        <span className="metrics__suffix" />
      </span>
      <span className="metrics__name">{name}</span>
      <span className="metrics__desc">{text}</span>
    </RevealItem>
  );
}
