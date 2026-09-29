import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PIPELINE } from '../../lib/demo';
import { EASE } from '../../lib/motion';
import SectionEyebrow from '../common/SectionEyebrow';
import { Reveal } from '../common/Reveal';
import StageGraphic from './scenes/StageGraphic';

/**
 * 04 — WORKFLOW
 *
 * Five steps, each roughly a screen tall, with the stage held beside them. The step
 * nearest the middle of the viewport is the active one, and the graphic on the right
 * accumulates through the sequence instead of resetting between steps — you watch the
 * address acquire transfers, then hops, then labels, then a risk score.
 *
 * With reduced motion nothing is scrubbed: step 1 stays selected and the rest is
 * still readable, because the descriptions live in the list, not only in the canvas.
 */
export default function WorkflowSection() {
  const reduce = useReducedMotion();
  const stepRefs = useRef<Array<HTMLElement | null>>([]);
  const active = useActiveStep(stepRefs, Boolean(reduce));

  const step = PIPELINE[active];

  return (
    <section className="section workflow" id="workflow" aria-labelledby="workflow-title">
      <div className="container">
        <Reveal className="section-head">
          <SectionEyebrow index="04">How it works</SectionEyebrow>
          <h2 id="workflow-title" className="section-title">
            One address in. A defensible case record out.
          </h2>
          <p className="lead">
            The pipeline is deliberately explicit. Every stage records what it did, what
            it could not do, and how confident it is, so the result can be examined
            rather than taken on trust.
          </p>
        </Reveal>

        <div className="workflow__layout">
          <div className="workflow__rail">
            <span className="workflow__rail-line" aria-hidden />
            <motion.span
              className="workflow__rail-progress"
              aria-hidden
              initial={false}
              animate={{ scaleY: (active + 1) / PIPELINE.length }}
              transition={{ duration: 0.5, ease: EASE.inOut }}
              style={{ transformOrigin: 'top' }}
            />

            {PIPELINE.map((item, i) => (
              <section
                key={item.num}
                ref={(el) => {
                  stepRefs.current[i] = el;
                }}
                className={`workflow__step${
                  active === i ? ' workflow__step--active' : active > i ? ' workflow__step--done' : ''
                }`}
                aria-current={active === i ? 'step' : undefined}
              >
                <span className="workflow__step-dot" aria-hidden>
                  {item.num}
                </span>
                <div className="workflow__step-body">
                  <span className="workflow__step-name">{item.title}</span>
                  <span className="workflow__step-desc">{item.body}</span>
                  <span className="workflow__step-detail">{item.detail}</span>
                </div>
              </section>
            ))}
          </div>

          <div className="workflow__stage">
            <div className="workflow__stage-canvas">
              <StageGraphic step={active} />
            </div>
            <div className="workflow__stage-caption">
              <span>
                Fig. 04 — {step.num} {step.title}
              </span>
              <span>
                {String(active + 1).padStart(2, '0')} / {String(PIPELINE.length).padStart(2, '0')}
              </span>
            </div>
          </div>
        </div>

        <Reveal className="workflow__foot">
          <Link to="/how-it-works" className="btn btn--ghost">
            Read the full method
            <ArrowRight size={15} aria-hidden />
          </Link>
        </Reveal>
      </div>
    </section>
  );
}

/**
 * Index of the pipeline step nearest the vertical middle of the viewport.
 * Pinned to 0 when motion is reduced, so the canvas still shows a meaningful state.
 */
function useActiveStep(
  refs: React.RefObject<Array<HTMLElement | null>>,
  staticMode: boolean,
): number {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (staticMode) {
      setStep(0);
      return;
    }

    const pick = () => {
      const elements = refs.current;
      if (!elements.length) return;
      const mid = window.innerHeight / 2;
      let best = 0;
      let bestDistance = Infinity;
      elements.forEach((el, i) => {
        if (!el) return;
        const box = el.getBoundingClientRect();
        const distance = Math.abs(box.top + box.height / 2 - mid);
        if (distance < bestDistance) {
          bestDistance = distance;
          best = i;
        }
      });
      setStep(best);
    };

    pick();
    window.addEventListener('scroll', pick, { passive: true });
    window.addEventListener('resize', pick);
    return () => {
      window.removeEventListener('scroll', pick);
      window.removeEventListener('resize', pick);
    };
  }, [refs, staticMode]);

  return step;
}
