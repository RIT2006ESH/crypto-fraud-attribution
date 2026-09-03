export function shortAddr(addr: string): string {
  if (!addr) return '';
  return addr.length <= 14 ? addr : `${addr.slice(0, 6)}\u2026${addr.slice(-4)}`;
}

export function eth(amount: string | number): string {
  const n = typeof amount === 'number' ? amount : Number(amount);
  if (!isFinite(n)) return '0';
  if (n !== 0 && Math.abs(n) < 0.0001) return '<0.0001';
  return n.toLocaleString('en-US', { maximumFractionDigits: 4 });
}

export function when(iso: string | null): string {
  if (!iso) return '\u2014';
  const d = new Date(iso);
  return isNaN(d.getTime())
    ? '\u2014'
    : d.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

export async function copy(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    /* clipboard unavailable; nothing to recover */
  }
}
