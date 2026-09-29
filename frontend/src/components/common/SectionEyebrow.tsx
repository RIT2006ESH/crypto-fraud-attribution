interface Props {
  children: string;
  index?: string;
  className?: string;
  as?: 'div' | 'span' | 'h2' | 'p';
}

/**
 * Section identifier — the small mono label that opens every marketing scene.
 *
 * Uppercase is reserved for exactly this: eyebrows, status labels and metadata.
 * Headlines and body copy stay in sentence case.
 */
export default function SectionEyebrow({ children, index, className, as: Tag = 'div' }: Props) {
  return (
    <Tag className={`eyebrow ${className ?? ''}`}>
      {index ? <span style={{ color: 'var(--accent-primary)' }}>{index}</span> : null}
      <span>{children}</span>
    </Tag>
  );
}
