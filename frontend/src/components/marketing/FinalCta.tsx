import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Reveal } from '../common/Reveal';

/**
 * 13 — FINAL CALL TO ACTION
 *
 * The workspace is the product. Everything above this point is an argument for it, so
 * this is where the argument ends and the button is.
 */
export default function FinalCta() {
  return (
    <section className="cta" aria-labelledby="cta-title">
      <span className="cta__ring" aria-hidden />
      <span className="cta__ring cta__ring--inner" aria-hidden />

      <div className="container cta__inner">
        <Reveal>
          <h2 id="cta-title" className="cta__title">
            Open a case.
          </h2>
        </Reveal>
        <Reveal delay={0.08}>
          <p className="cta__sub">
            Start from any address. You will have a mapped graph, resolved entities, a
            risk breakdown and a report structure within the trace depth — and you will
            be able to see exactly how each part was arrived at.
          </p>
        </Reveal>
        <Reveal delay={0.16} className="cta__actions">
          <Link to="/investigate" className="btn btn--primary btn--lg">
            Start an investigation
            <ArrowRight size={16} aria-hidden />
          </Link>
          <Link to="/request-demo" className="btn btn--ghost btn--lg">
            Talk to the team
          </Link>
        </Reveal>
      </div>
    </section>
  );
}
