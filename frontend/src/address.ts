/**
 * Address normalisation and diagnostics for the investigation console.
 *
 * Mirrors backend/src/util/address.ts — supports both EVM (0x…) and Tron (T…) formats.
 * Keep both files in sync; they share no build.
 *
 * Pasted addresses routinely carry invisible characters — zero-width spaces, joiners, bidi
 * marks and BOMs picked up from web pages, PDFs and chat clients. Strip them before validating.
 */

/** Soft hyphen, zero-width, bidi-control and BOM code points that survive String.trim(). */
const INVISIBLE_RE = /[\u00AD\u200B-\u200F\u202A-\u202E\u2060-\u2064\uFEFF]/g;
const HEX_CHAR_RE = /^[a-fA-F0-9]$/;
const HEX_BODY_RE = /^[a-fA-F0-9]{40}$/;
const EVM_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

/**
 * Tron uses base58check encoding.
 * All mainnet addresses start with 'T' and are exactly 34 characters.
 * Character set: 1-9, A-Z (no O, I), a-z (no l) — standard base58 alphabet.
 */
const TRON_ADDRESS_RE = /^T[1-9A-HJ-NP-Za-km-z]{33}$/;

export function normalizeAddress(raw: string): string {
  const cleaned = raw.replace(INVISIBLE_RE, "").trim();
  return cleaned.startsWith("0X") ? `0x${cleaned.slice(2)}` : cleaned;
}

export function isEvmAddress(raw: string): boolean {
  return EVM_ADDRESS_RE.test(normalizeAddress(raw));
}

export function isTronAddress(raw: string): boolean {
  return TRON_ADDRESS_RE.test(normalizeAddress(raw));
}

/** Returns true for any supported address format (EVM or Tron). */
export function isAddress(raw: string): boolean {
  const norm = normalizeAddress(raw);
  return EVM_ADDRESS_RE.test(norm) || TRON_ADDRESS_RE.test(norm);
}

/**
 * Infers the chain from the address format.
 * Returns "ethereum" for 0x EVM addresses, "tron" for T… Tron addresses, null otherwise.
 */
export function detectChain(raw: string): "ethereum" | "tron" | null {
  const norm = normalizeAddress(raw);
  if (EVM_ADDRESS_RE.test(norm)) return "ethereum";
  if (TRON_ADDRESS_RE.test(norm)) return "tron";
  return null;
}

/**
 * Why an address is unusable, phrased for the investigator, or null when it is valid.
 */
export function describeAddressProblem(raw: string): string | null {
  const value = normalizeAddress(raw);
  if (value === "") return "Enter the wallet address you want to trace.";
  if (/\s/.test(value)) return "Remove the spaces inside the address.";

  // Tron address — validate before applying EVM rules.
  if (value.startsWith("T")) {
    if (TRON_ADDRESS_RE.test(value)) return null;
    if (value.length !== 34)
      return `That Tron address is ${value.length} characters; a valid Tron address is 34 characters starting with T.`;
    return "That does not look like a valid Tron address — it should be 34 base-58 characters starting with T.";
  }

  // EVM address validation.
  if (!value.startsWith("0x"))
    return "An Ethereum address starts with 0x, and a Tron address starts with T.";

  const body = value.slice(2);
  if (HEX_BODY_RE.test(body)) return null;

  const bad = [...body].find((ch) => !HEX_CHAR_RE.test(ch));
  if (bad !== undefined)
    return `"${bad}" is not a hex character — an Ethereum address uses only 0-9 and a-f.`;

  return `That address is ${value.length} characters; an Ethereum address is 42 (0x plus 40 hex digits).`;
}

