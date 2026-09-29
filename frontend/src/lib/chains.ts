import type { ChainInfo } from '../types';

/**
 * Chain presentation.
 *
 * `GET /api/chains` is the authority for what is supported. These entries only add
 * display metadata for the chains the backend already declares; nothing here implies
 * a chain the backend cannot trace.
 */

export interface ChainMeta {
  id: string;
  label: string;
  short: string;
  nativeSymbol: string;
  dataSource: string;
  addressFormat: string;
  notes: string;
  /** Short capability tags for the chain cards. */
  facts: string[];
  /**
   * Block-explorer link templates, when we can build a link we are confident is correct.
   * Absent rather than guessed: a wrong "verify on explorer" link is worse than none.
   * Tron is omitted because TronScan routes by URL fragment, which cannot be built as a
   * plain href and is not worth special-casing here.
   */
  explorerAddressTemplate?: string;
  explorerTxTemplate?: string;
}

export const CHAIN_META: Record<string, ChainMeta> = {
  ethereum: {
    id: 'ethereum',
    label: 'Ethereum Mainnet',
    short: 'Ethereum',
    nativeSymbol: 'ETH',
    dataSource: 'Etherscan',
    addressFormat: '0x + 40 hex characters',
    notes: 'Native ETH transfers plus ERC-20 token contracts, including the major stablecoins.',
    facts: ['ETH + ERC-20', '4 hop depth', 'Etherscan indexer'],
    explorerAddressTemplate: 'https://etherscan.io/address/{address}',
    explorerTxTemplate: 'https://etherscan.io/tx/{hash}',
  },
  tron: {
    id: 'tron',
    label: 'Tron Network',
    short: 'Tron',
    nativeSymbol: 'TRX',
    dataSource: 'TronGrid',
    addressFormat: 'T + 33 base-58 characters',
    notes: 'Native TRX transfers plus TRC-20 token contracts, including TRC-20 USDT.',
    facts: ['TRX + TRC-20', '4 hop depth', 'TronGrid indexer'],
  },
  all: {
    id: 'all',
    label: 'All Chains',
    short: 'All chains',
    nativeSymbol: '',
    dataSource: 'Both providers',
    addressFormat: 'Auto-detected from the address',
    notes: 'Fans the request out across every supported chain and returns the worst-case result.',
    facts: ['Side by side', 'No cross-chain inference'],
  },
};

/** Chains the backend can genuinely trace today. Never expand this from memory. */
export const REAL_CHAIN_IDS = ['ethereum', 'tron'] as const;

/** The three entries returned by /api/chains, in picker order. */
export const CHAIN_PICKER_IDS = ['ethereum', 'tron', 'all'] as const;

export type ChainPickerId = (typeof CHAIN_PICKER_IDS)[number];

export function chainMeta(id: string | null | undefined): ChainMeta {
  if (id && CHAIN_META[id]) return CHAIN_META[id];
  return CHAIN_META.all;
}

/** True when the address belongs to the given chain, from its prefix alone. */
export function addressMatchesChain(address: string, chainId: string): boolean {
  if (chainId === 'all') return true;
  if (chainId === 'tron') return address.startsWith('T');
  if (chainId === 'ethereum') return address.toLowerCase().startsWith('0x');
  return true;
}

/** Filtering helper used by the console when the backend list is unavailable. */
export function fallbackChains(): ChainInfo[] {
  return [CHAIN_META.ethereum, CHAIN_META.tron, CHAIN_META.all].map((c) => ({
    id: c.id,
    name: c.label,
    nativeSymbol: c.nativeSymbol,
    tokens: c.id === 'ethereum' ? ['USDT', 'USDC', 'WETH', 'DAI'] : c.id === 'tron' ? ['USDT', 'USDC'] : [],
    multi: c.id === 'all' ? true : undefined,
  }));
}
