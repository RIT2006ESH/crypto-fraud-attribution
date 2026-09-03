/**
 * Address normalisation and diagnostics for the investigation console.
 *
 * Mirrors backend/src/util/address.ts verbatim so the form accepts exactly what the API
 * accepts and words a rejection identically — the two packages share no build, in the same
 * way types.ts is duplicated. Keep the two files in step.
 *
 * Pasted addresses routinely carry invisible characters — zero-width spaces, joiners, bidi
 * marks and BOMs picked up from web pages, PDFs and chat clients. They render as nothing and
 * survive String.trim(), so a bare regex rejects an address the user can plainly see is
 * correct, with no way to spot the cause. Strip them, and accept the "0X" prefix that
 * Etherscan itself accepts, before validating.
 */

/** Soft hyphen, zero-width, bidi-control and BOM code points that survive String.trim(). */
const INVISIBLE_RE = /[\u00AD\u200B-\u200F\u202A-\u202E\u2060-\u2064\uFEFF]/g;
const HEX_CHAR_RE = /^[a-fA-F0-9]$/;
const HEX_BODY_RE = /^[a-fA-F0-9]{40}$/;
const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

export function normalizeAddress(raw: string): string {
  const cleaned = raw.replace(INVISIBLE_RE, "").trim();
  return cleaned.startsWith("0X") ? `0x${cleaned.slice(2)}` : cleaned;
}

export function isAddress(raw: string): boolean {
  return ADDRESS_RE.test(normalizeAddress(raw));
}

/**
 * Why an address is unusable, phrased for the investigator, or null when it is valid.
 * The character count is spelled out because a truncated paste is the common case.
 */
export function describeAddressProblem(raw: string): string | null {
  const value = normalizeAddress(raw);
  if (value === "") return "Enter the wallet address you want to trace.";
  if (/\s/.test(value)) return "Remove the spaces inside the address.";
  if (!value.startsWith("0x")) return "An Ethereum address starts with 0x.";

  const body = value.slice(2);
  if (HEX_BODY_RE.test(body)) return null;

  const bad = [...body].find((ch) => !HEX_CHAR_RE.test(ch));
  if (bad !== undefined) {
    return `"${bad}" is not a hex character — an Ethereum address uses only 0-9 and a-f.`;
  }
  return `That address is ${value.length} characters; an Ethereum address is 42 (0x plus 40 hex digits).`;
}
