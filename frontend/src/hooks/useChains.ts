import { useEffect, useState } from 'react';
import { fetchChains } from '../api';
import { fallbackChains } from '../lib/chains';
import type { ChainInfo } from '../types';

/**
 * Supported chains, straight from `GET /api/chains`.
 *
 * The backend is the authority on what can be traced. If it cannot be reached the
 * caller gets the built-in list and a `reachable: false` flag, so the interface can
 * say so rather than implying a live connection.
 */
export function useChains() {
  const [chains, setChains] = useState<ChainInfo[]>([]);
  const [reachable, setReachable] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    fetchChains()
      .then((data) => {
        if (!active) return;
        setChains(data);
        setReachable(true);
      })
      .catch(() => {
        if (!active) return;
        setChains(fallbackChains());
        setReachable(false);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  /** Chains that can genuinely be traced, excluding the "all" meta entry. */
  const traceable = chains.filter((chain) => !chain.multi);

  return { chains, traceable, reachable, loading };
}
