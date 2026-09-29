interface Props {
  size?: number;
  className?: string;
  title?: string;
}

/**
 * CASETRACE mark — a capture frame with a single traced connection inside it.
 *
 * Four corner brackets read as "evidence captured"; the dashed line between two
 * nodes reads as "a path followed". Drawn rather than licensed, and used at both
 * the marketing and workspace scale.
 */
export default function BrandMark({ size = 26, className, title = 'CASETRACE' }: Props) {
  const bracket = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.5,
    strokeLinecap: 'round' as const,
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      role="img"
      aria-label={title}
    >
      <g {...bracket} strokeOpacity={0.9}>
        <path d="M4.5 8.5V5.5A1 1 0 0 1 5.5 4.5H8.5" />
        <path d="M15.5 4.5H18.5A1 1 0 0 1 19.5 5.5V8.5" />
        <path d="M19.5 15.5V18.5A1 1 0 0 1 18.5 19.5H15.5" />
        <path d="M8.5 19.5H5.5A1 1 0 0 1 4.5 18.5V15.5" />
      </g>
      <line
        x1="9.4"
        y1="15.1"
        x2="14.6"
        y2="8.9"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeDasharray="2.2 2.2"
        strokeOpacity={0.75}
        strokeLinecap="round"
      />
      <circle cx="7.8" cy="16.7" r="2.1" fill="none" stroke="currentColor" strokeWidth={1.6} />
      <circle cx="16.2" cy="7.3" r="2.1" fill="currentColor" />
    </svg>
  );
}
