import { motion, useReducedMotion } from 'framer-motion';
import type { ElementType, ReactNode } from 'react';
import {
  EASE,
  VIEWPORT,
  fadeIn,
  fadeUp,
  fadeUpSm,
  scaleSoft,
  stagger,
  type VariantsLike,
} from '../../lib/motion';

/**
 * Scroll choreography.
 *
 * `RevealGroup` staggers its children; `RevealItem` inherits the group's variants.
 * Sections therefore animate as one composed unit — headline, then description, then
 * visual — instead of every node firing on its own observer.
 *
 * All three components short-circuit to their final state under reduced motion.
 */

const VARIANTS = { fadeUp, fadeUpSm, fadeIn, scaleSoft } satisfies Record<VariantsLike, unknown>;

interface RevealProps {
  children: ReactNode;
  variant?: VariantsLike;
  delay?: number;
  duration?: number;
  className?: string;
  as?: ElementType;
  amount?: number;
}

/** A standalone reveal. Use when there is no sibling sequence to coordinate with. */
export function Reveal({
  children,
  variant = 'fadeUp',
  delay = 0,
  duration,
  className,
  as = 'div',
  amount = VIEWPORT.amount,
}: RevealProps) {
  const reduce = useReducedMotion();
  const MotionTag = motion[as as 'div'] ?? motion.div;

  if (reduce) {
    const Tag = as as ElementType;
    return <Tag className={className}>{children}</Tag>;
  }

  return (
    <MotionTag
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount }}
      variants={VARIANTS[variant]}
      transition={duration ? { duration, delay, ease: EASE.soft } : { delay }}
    >
      {children}
    </MotionTag>
  );
}

interface GroupProps {
  children: ReactNode;
  className?: string;
  step?: number;
  delay?: number;
  amount?: number;
  as?: ElementType;
}

/** Parent that establishes the stagger order for a sequence of items. */
export function RevealGroup({
  children,
  className,
  step = 0.08,
  delay = 0,
  amount = VIEWPORT.amount,
  as = 'div',
}: GroupProps) {
  const reduce = useReducedMotion();
  const MotionTag = motion[as as 'div'] ?? motion.div;
  const variants = stagger(step, delay);

  if (reduce) {
    const Tag = as as ElementType;
    return <Tag className={className}>{children}</Tag>;
  }

  return (
    <MotionTag
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount }}
      variants={variants}
    >
      {children}
    </MotionTag>
  );
}

interface ItemProps {
  children: ReactNode;
  variant?: VariantsLike;
  className?: string;
  as?: ElementType;
}

/** Child of a RevealGroup. Declares variants only; the group drives the sequence. */
export function RevealItem({ children, variant = 'fadeUp', className, as = 'div' }: ItemProps) {
  const reduce = useReducedMotion();
  const MotionTag = motion[as as 'div'] ?? motion.div;

  if (reduce) {
    const Tag = as as ElementType;
    return <Tag className={className}>{children}</Tag>;
  }

  return (
    <MotionTag className={className} variants={VARIANTS[variant]}>
      {children}
    </MotionTag>
  );
}

export default Reveal;
