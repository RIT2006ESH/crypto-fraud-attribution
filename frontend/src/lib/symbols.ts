/**
 * Token symbol handling.
 *
 * A token symbol is not metadata the service can vouch for. It is a string the token's
 * deployer chose, which means anyone can choose a symbol that looks like a real asset.
 * A live trace of one address in this repository returns symbols like "vitalik bull",
 * "ĖTḨ" and "$ USDCFree.com - Visit to claim" alongside genuine USDT transfers.
 *
 * So symbols are treated as claims, not facts. They are sanitised for display, and
 * anything that resembles impersonation, advertising or a non-Latin script is surfaced
 * rather than passed through. Nothing here decides whether a token is genuine — only the
 * contract and its liquidity would, and the service does not model that.
 */

const MAX_LENGTH = 24;

/** Well-known symbols an impersonator would reach for first. */
const KNOWN_SYMBOLS = [
  'USDT', 'USDC', 'DAI', 'BUSD', 'TUSD', 'FDUSD', 'WETH', 'ETH', 'TRX', 'WBTC', 'SHIB', 'UNI',
];

/**
 * Letters outside the Latin alphabet that render as a Latin letter. Enough of the set to
 * catch the homoglyph swaps that actually turn up in token tickers.
 */
const CONFUSABLES: Record<string, string> = {
  // Cyrillic
  '\u0405': 'S', '\u0406': 'I', '\u0408': 'J', '\u0410': 'A', '\u0412': 'B', '\u0415': 'E', '\u041A': 'K', '\u041C': 'M', '\u041D': 'H',
  '\u041E': 'O', '\u0420': 'P', '\u0421': 'C', '\u0422': 'T', '\u0423': 'Y', '\u0425': 'X',
  '\u0430': 'a', '\u0435': 'e', '\u043E': 'o', '\u0440': 'p', '\u0441': 'c', '\u0443': 'y',
  '\u0445': 'x', '\u0456': 'i', '\u0455': 's', '\u04AF': 'y', '\u0491': 'r', '\u04E3': 'y',
  // Greek
  '\u0391': 'A', '\u0392': 'B', '\u0395': 'E', '\u0396': 'Z', '\u0397': 'H', '\u0399': 'I',
  '\u039A': 'K', '\u039C': 'M', '\u039D': 'N', '\u039F': 'O', '\u03A1': 'P', '\u03A4': 'T',
  '\u03A5': 'Y', '\u03A7': 'X', '\u03B1': 'a', '\u03B5': 'e', '\u03B9': 'i', '\u03BF': 'o',
  '\u03C1': 'p', '\u03C5': 'u', '\u03C7': 'x',
};

/** Phrases that turn up in scam and bait tokens rather than in real tickers. */
const PROMOTIONAL = [
  'claim', 'visit', 'free', 'airdrop', 'giveaway', 'bonus', 'reward', 'presale', 'winner',
  'voucher', 'redeem', 'gift', 'discount', '.com', 'www.', 'http',
];

export type SymbolAdvisory =
  | { kind: 'impersonation'; known: string }
  | { kind: 'promotional' }
  | { kind: 'non-latin' };

/**
 * Display form of a symbol: control characters removed, whitespace collapsed, and long
 * strings truncated. A symbol that is entirely noise sanitises to an empty string, which
 * the caller renders as "unlabelled token" rather than as blank.
 */
export function sanitizeSymbol(raw: string | null | undefined): string {
  if (!raw) return '';
  // Stripping control characters is the point of this function: they are invisible in a
  // table cell but can still break layout or smuggle misleading spacing into a symbol.
  // eslint-disable-next-line no-control-regex
  const cleaned = raw.replace(/[\u0000-\u001F\u007F-\u009F]/g, ' ').replace(/\s+/g, ' ').trim();
  if (cleaned.length <= MAX_LENGTH) return cleaned;
  return `${cleaned.slice(0, MAX_LENGTH - 1).trimEnd()}…`;
}

/** The display symbol, falling back to a neutral label for a native or empty symbol. */
export function displaySymbol(raw: string | null | undefined): string {
  const sanitized = sanitizeSymbol(raw);
  if (sanitized) return sanitized;
  return raw === null || raw === undefined ? 'native' : 'unnamed token';
}

/**
 * Why a symbol should not be read as an asset name, or null when nothing stands out.
 * Ordered most to least serious: an impersonated ticker is the case that matters.
 */
export function symbolAdvisory(raw: string | null | undefined): SymbolAdvisory | null {
  const symbol = sanitizeSymbol(raw);
  if (!symbol) return null;

  const folded = foldConfusables(symbol).toUpperCase();
  const plain = symbol.toUpperCase();

  const impersonated = KNOWN_SYMBOLS.find(
    (known) => folded === known && plain !== known,
  );
  if (impersonated) return { kind: 'impersonation', known: impersonated };

  const lower = symbol.toLowerCase();
  if (PROMOTIONAL.some((phrase) => lower.includes(phrase))) return { kind: 'promotional' };

  if (hasNonLatinLetter(symbol)) return { kind: 'non-latin' };

  return null;
}

/** One sentence explaining the advisory, for a tooltip or an inline note. */
export function symbolAdvisoryText(advisory: SymbolAdvisory): string {
  switch (advisory.kind) {
    case 'impersonation':
      return `This symbol imitates ${advisory.known} using look-alike characters. It is not ${advisory.known}.`;
    case 'promotional':
      return 'This symbol contains promotional text. Token symbols are chosen by the deployer, not assigned by the chain.';
    case 'non-latin':
      return 'This symbol contains non-Latin characters. A legitimate ticker for a major asset is not written this way.';
  }
}

/** Maps look-alike letters onto their Latin equivalents so a homoglyph can be spotted. */
function foldConfusables(value: string): string {
  let out = '';
  for (const char of value) out += CONFUSABLES[char] ?? char;
  return out.normalize('NFKC');
}

function hasNonLatinLetter(value: string): boolean {
  return /\p{Letter}/u.test(value.replace(/[A-Za-z]/g, ''));
}
