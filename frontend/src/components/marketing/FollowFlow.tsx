import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, CornerDownRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { DEMO_PATH_IDS, DEMO_NODES } from '../../lib/demo';
import { EASE } from '../../lib/motion';
import SectionEyebrow from '../common/SectionEyebrow';
import { Reveal } from '../common/Reveal';
import {
  EdgeMarkers,
  EntityNode,
  GraphEdge,
  edgeGeometry,
  nodeIndex,
  pathWaypoints,
} from './scenes/primitives';

/**
 * 05 — THE SIGNATURE SCENE
 *
 * One path, revealed hop by hop as the reader scrolls. This is the product in a
 * single gesture: an address, the transfers it made, the hops they took, the labels
 * that appeared along the way, and where the funds ended up.
 *
 * The scroll listener measures progress rather than snapping to steps, so the path
 * draws at the reader's pace. Under reduced motion the whole path is shown at once
 * and the captions become a static list.
 */

const VB_W = 1000;
const VB_H = 1000;

const CAPTIONS = [
  { step: 'Step 01', text: 'The reported wallet sends 18,500 USDT to an address with no label.' },
  { step: 'Step 02', text: 'That address forwards 17,900 of it onward to an address that resolves to a mixer.' },
  { step: 'Step 03', text: 'From the mixer, 19,240 USDT continues to a further wallet two hops later.' },
  { step: 'Step 04', text: 'The last leg terminates at an address present on a published sanctions list.' },
  { step: 'Outcome', text: 'Four hops, one sanctioned terminus, and a risk score of 100 out of 100.' },
] as const;

export default function FollowFlow() {
  const reduce = useReducedMotion();
  const viewportRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);

  const index = useMemo(() => nodeIndex(DEMO_NODES), []);
  const pathNodes = useMemo(
    () =>
      DEMO_PATH_IDS.map((id) => index.get(id)).filter((n): n is NonNullable<typeof n> => Boolean(n)),
    [index],
  );
  const { xs, ys } = useMemo(() => pathWaypoints(pathNodes), [pathNodes]);

  const segments = useMemo(
    () => pathNodes.slice(0, -1).map((from, i) => ({ from, to: pathNodes[i + 1] })),
    [pathNodes],
  );

  useEffect(() => {
    if (reduce) {
      setProgress(1);
      return;
    }
    const el = viewportRef.current;
    if (!el) return;

    const measure = () => {
      const box = el.getBoundingClientRect();
      // 0 when the top of the viewport section reaches 80% down the screen,
      // 1 when its bottom reaches 25% up — i.e. it has scrolled through.
      const total = box.height + window.innerHeight * 0.55;
      const travelled = window.innerHeight * 0.8 - box.top;
      setProgress(Math.min(1, Math.max(0, travelled / total)));
    };

    measure();
    window.addEventListener('scroll', measure, { passive: true });
    window.addEventListener('resize', measure);
    return () => {
      window.removeEventListener('scroll', measure);
      window.removeEventListener('resize', measure);
    };
  }, [reduce]);

  const shown = reduce ? CAPTIONS.length : Math.min(CAPTIONS.length, Math.floor(progress * CAPTIONS.length) + 1);
  const caption = CAPTIONS[Math.max(0, shown - 1)];

  return (
    <section className="section flow" id="flow" aria-labelledby="flow-title">
      <div className="container flow__layout">
        <div className="flow__sticky">
          <Reveal>
            <SectionEyebrow index="05">The path</SectionEyebrow>
          </Reveal>
          <Reveal delay={0.06}>
            <h2 id="flow-title" className="flow__title">
              The whole investigation is one path you can re-walk.
            </h2>
          </Reveal>

          <div className="flow__caption" aria-live="polite">
            <span className="flow__caption-step">{caption.step}</span>
            <p className="flow__caption-text">{caption.text}</p>
            <div className="flow__progress" aria-hidden>
              {CAPTIONS.map((item, i) => (
                <span
                  key={item.step}
                  className={`flow__progress-tick${i < shown ? ' flow__progress-tick--on' : ''}`}
                />
              ))}
            </div>
          </div>

          <Reveal delay={0.12}>
            <Link to="/investigate" className="btn btn--ghost">
              Reconstruct it yourself
              <ArrowRight size={15} aria-hidden />
            </Link>
          </Reveal>
        </div>

        <div className="flow__viewport" ref={viewportRef}>
          <div className="flow__stick">
            <div className="flow__stage">
              <svg
                viewBox={`0 0 ${VB_W} ${VB_H}`}
                preserveAspectRatio="xMidYMid meet"
                role="img"
                aria-label="Illustrative diagram of the investigation path: the reported wallet sends USDT to an unlabelled address, which forwards it to a mixer, then to a further wallet, and finally to a sanctioned address."
              >
                <EdgeMarkers idPrefix="flow" />

                {/* Edges appear just ahead of the node they lead to. */}
                {segments.map((segment, i) => (
                  <Segment
                    key={`${segment.from.id}-${segment.to.id}`}
                    from={segment.from}
                    to={segment.to}
                    delay={(i + 1) / (CAPTIONS.length + 1)}
                    progress={progress}
                    staticMode={Boolean(reduce)}
                  />
                ))}

                {pathNodes.map((node, i) => (
                  <motion.g
                    key={node.id}
                    initial={reduce ? undefined : { opacity: 0 }}
                    animate={reduce ? undefined : { opacity: 1 }}
                    transition={{
                      duration: 0.45,
                      ease: EASE.soft,
                      delay: reduce ? 0 : (i + 1) / (CAPTIONS.length + 1) * 0.9,
                    }}
                  >
                    <EntityNode
                      node={node}
                      active
                      showLabel
                      showSub
                      labelOffset={node.x > 700 ? -34 : 34}
                    />
                  </motion.g>
                ))}

                {/* Marker travelling the traced path, only while the scene is read. */}
                {!reduce ? (
                  <motion.circle
                    r={4}
                    style={{ fill: 'var(--accent-bright)' }}
                    initial={{ cx: xs[0], cy: ys[0], opacity: 0 }}
                    animate={{
                      cx: xs,
                      cy: ys,
                      opacity: [0, 1, 1, 0],
                      transition: {
                        duration: 3.4,
                        times: [0, 0.05, 0.9, 1],
                        repeat: Infinity,
                        repeatDelay: 1.4,
                        ease: EASE.inOut,
                      },
                    }}
                  />
                ) : null}
              </svg>
            </div>

            <div className="flow__footer">
              <span>
                <CornerDownRight size={12} aria-hidden style={{ verticalAlign: '-2px', marginRight: 6 }} />
                Path CF-2041 · {DEMO_PATH_IDS.length - 1} hops
              </span>
              <span>Illustrative data</span>
            </div>
          </div>
        </div>
      </div>

      <div className="container">
        <Reveal className="flow__outcome">
          <p className="flow__outcome-text">
            A defensible record, not a screenshot.
          </p>
          <Link to="/platform" className="btn btn--ghost">
            What the platform gives you
            <ArrowRight size={15} aria-hidden />
          </Link>
        </Reveal>
      </div>
    </section>
  );
}

/** One hop's edge, revealed once the reader has scrolled past its threshold. */
function Segment({
  from,
  to,
  delay,
  progress,
  staticMode,
}: {
  from: (typeof DEMO_NODES)[number];
  to: (typeof DEMO_NODES)[number];
  delay: number;
  progress: number;
  staticMode: boolean;
}) {
  const geometry = useMemo(() => edgeGeometry(from, to, 0, 0.14), [from, to]);
  const revealed = staticMode || progress >= delay;

  return (
    <g>
      <GraphEdge
        edge={{ from: from.id, to: to.id, amount: '', asset: 'USDT', rail: 'stable', onPath: true }}
        from={from}
        to={to}
        index={0}
        showLabel
        emphasised
        markerId="flow-path"
      />
      <AnimatePresence initial={false}>
        {revealed ? (
          <motion.path
            d={geometry.d}
            fill="none"
            stroke="var(--accent-primary)"
            strokeWidth={1.4}
            strokeOpacity={0.5}
            initial={staticMode ? { pathLength: 1, opacity: 1 } : { pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 0.7, ease: EASE.inOut }}
          />
        ) : null}
      </AnimatePresence>
    </g>
  );
}
