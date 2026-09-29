import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, Boxes, Database, GitBranch } from 'lucide-react';
import HeroGraph from './scenes/HeroGraph';
import { DURATION, EASE } from '../../lib/motion';
import { chainMeta } from '../../lib/chains';

/**
 * 01 — HERO
 *
 * The headline reveals line by line because a headline that fades in as one block
 * reads as a paragraph. The graph runs its own sequence underneath, offset by about
 * a second so the two never compete.
 */
export default function Hero() {
  const reduce = useReducedMotion();

  const line = (index: number) =>
    reduce
      ? {}
      : {
          initial: { y: '108%' },
          animate: { y: '0%' },
          transition: { duration: DURATION.hero, delay: 0.28 + index * 0.11, ease: EASE.soft },
        };

  const fade = (delay: number) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, y: 16 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: DURATION.section, delay, ease: EASE.soft },
        };

  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="tech-grid" aria-hidden />
      <div
        className="grid-block"
        aria-hidden
        style={{ top: '18%', left: '4%', width: 220, height: 320 }}
      />
      <div
        className="grid-block"
        aria-hidden
        style={{ bottom: '8%', right: '6%', width: 300, height: 220 }}
      />

      <div className="container hero__layout">
        <div className="hero__copy">
          <motion.p className="eyebrow" {...fade(0.05)}>
            Crypto forensic intelligence
          </motion.p>

          <h1 id="hero-title" className="hero__title">
            <span className="hero__title-line" style={{ display: 'block', overflow: 'hidden' }}>
              <motion.span style={{ display: 'block' }} {...line(0)}>
                Follow the money.
              </motion.span>
            </span>
            <span className="hero__title-line" style={{ display: 'block', overflow: 'hidden' }}>
              <motion.span className="hero__title-em" style={{ display: 'block' }} {...line(1)}>
                Find the path.
              </motion.span>
            </span>
          </h1>

          <motion.p className="hero__sub" {...fade(0.72)}>
            CASETRACE maps on-chain fund movement, resolves the entities behind each
            address, and turns a wide transaction graph into an investigator-readable
            case record.
          </motion.p>

          <motion.div className="hero__actions" {...fade(0.84)}>
            <Link to="/investigate" className="btn btn--primary btn--lg">
              Start an investigation
              <ArrowRight size={16} aria-hidden />
            </Link>
            <Link to="/platform" className="btn btn--ghost btn--lg">
              Explore platform
            </Link>
          </motion.div>

          <motion.div className="hero__footnote" {...fade(0.96)}>
            <span className="hero__footnote-item">
              <Boxes size={13} aria-hidden style={{ color: 'var(--entity-exchange)' }} />
              {chainMeta('ethereum').label}
            </span>
            <span className="hero__footnote-item">
              <GitBranch size={13} aria-hidden style={{ color: 'var(--text-muted)' }} />
              {chainMeta('tron').label}
            </span>
            <span className="hero__footnote-item">
              <Database size={13} aria-hidden style={{ color: 'var(--text-faint)' }} />
              {chainMeta('ethereum').dataSource} · {chainMeta('tron').dataSource}
            </span>
          </motion.div>
        </div>

        <motion.div
          className="hero__visual"
          initial={reduce ? undefined : { opacity: 0, y: 30, scale: 0.985 }}
          animate={reduce ? undefined : { opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 1.3, delay: 0.45, ease: EASE.soft }}
        >
          <div className="hero__frame">
            <div className="hero__frame-tag">
              <span>Fig. 01</span>
              <span style={{ color: 'var(--text-faint)' }}>/</span>
              <span>Fund flow map</span>
            </div>
            <HeroGraph />
          </div>
        </motion.div>
      </div>
    </section>
  );
}
