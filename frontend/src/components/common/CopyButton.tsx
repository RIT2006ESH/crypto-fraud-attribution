import { useEffect, useRef, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { copyToClipboard } from '../../format';

interface Props {
  value: string;
  /** Screen-reader label, e.g. "Copy wallet address". */
  label: string;
  className?: string;
  size?: number;
}

/** Copy control that confirms in place and always announces itself to a screen reader. */
export default function CopyButton({ value, label, className, size = 12 }: Props) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const handleCopy = async () => {
    const ok = await copyToClipboard(value);
    if (!ok) return;
    setCopied(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <button
      type="button"
      className={`copy-btn ${copied ? 'copy-btn--done' : ''} ${className ?? ''}`}
      onClick={handleCopy}
      aria-label={copied ? `${label}: copied` : label}
      title={copied ? 'Copied' : label}
    >
      {copied ? <Check size={size} aria-hidden /> : <Copy size={size} aria-hidden />}
      <span className="sr-only" role="status">
        {copied ? 'Copied' : ''}
      </span>
    </button>
  );
}
