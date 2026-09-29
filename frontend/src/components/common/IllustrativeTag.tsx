import { FlaskConical } from 'lucide-react';

interface Props {
  className?: string;
  /** Overrides the default wording when a visual needs to be more specific. */
  label?: string;
}

/**
 * Marks a visual as illustrative.
 *
 * The marketing site draws synthetic subgraphs, synthetic attributions and a worked
 * risk example. Nothing here is an investigation result, and this marker keeps that
 * distinction visible on every surface that shows demo data — including inside the
 * product preview, where a visitor would otherwise assume they are looking at a live
 * case.
 */
export default function IllustrativeTag({ className, label = 'Illustrative · synthetic data' }: Props) {
  return (
    <span className={`badge badge--neutral ${className ?? ''}`} style={{ gap: 7 }}>
      <FlaskConical size={11} aria-hidden />
      {label}
    </span>
  );
}
