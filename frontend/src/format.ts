export function shortenAddress(addr?: string | null): string {
  if (!addr) return "—";
  if (addr.length <= 16) return addr;
  return `${addr.slice(0, 8)}…${addr.slice(-6)}`;
}

export function shortenHash(hash?: string | null): string {
  if (!hash) return "—";
  if (hash.length <= 16) return hash;
  return `${hash.slice(0, 10)}…${hash.slice(-6)}`;
}

export function formatEth(val?: string | number | null): string {
  if (val === null || val === undefined) return "0.00 ETH";
  const num = typeof val === "number" ? val : parseFloat(val as string);
  if (isNaN(num)) return "0.00 ETH";
  return `${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })} ETH`;
}

/**
 * Token-aware amount formatter.
 *  - With symbol:    formatAmount("150.5", "USDT")  → "150.50 USDT"
 *  - Native ETH:     formatAmount("0.024", null)     → "0.024 ETH"
 *  - Native TRX:     formatAmount("12.3", "TRX")     → "12.30 TRX"
 *  - Unknown native: formatAmount("0.01")            → "0.01 ETH"  (fallback)
 */
export function formatAmount(val?: string | number | null, tokenSymbol?: string | null): string {
  if (val === null || val === undefined) return "—";
  const num = typeof val === "number" ? val : parseFloat(val as string);
  if (isNaN(num)) return "—";
  const symbol = tokenSymbol || "ETH";
  // Stablecoins (USDT/USDC/DAI) → 2 decimal places; others → up to 6
  const isStable = ["USDT", "USDC", "DAI", "BUSD"].includes(symbol.toUpperCase());
  const formatted = num.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: isStable ? 2 : 6,
  });
  return `${formatted} ${symbol}`;
}

export function formatDate(isoStr?: string | null): string {
  if (!isoStr) return "—";
  try {
    const d = new Date(isoStr);
    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return isoStr;
  }
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

