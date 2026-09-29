import { useCallback, useEffect, useReducer, useRef } from 'react';
import { fetchChains, submitTrace } from '../api';
import { fallbackChains } from '../lib/chains';
import type { GraphFilter, GraphMode, FocusRequest, Selection } from '../lib/graph';
import {
  initialInvestigationState,
  investigationReducer,
  type InvestigationState,
} from '../state/investigationReducer';
import type { TraceInput } from '../types';

/**
 * Owns the investigation lifecycle: one POST, the stage the request is in, and
 * every view action the workspace exposes.
 *
 * The staged progress is time-based rather than server-reported — the trace API is a
 * single request with no progress channel. It communicates which phase the run is in
 * and never invents a percentage or an ETA.
 */

/** Milliseconds after which a still-running request advances to the next stage. */
const STAGE_DELAYS = [500, 2000, 3600];

export function useInvestigation() {
  const [state, dispatch] = useReducer(investigationReducer, initialInvestigationState);
  const timers = useRef<number[]>([]);
  /**
   * Monotonic run id, owned here rather than read back out of the reducer. Reading it
   * from state would break if two runs were started before React re-rendered, because
   * both would compute the same id and the first response would win.
   */
  const runIdRef = useRef(0);

  const clearTimers = useCallback(() => {
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  // Supported chains come from the backend. If it is unreachable we fall back to the
  // built-in list rather than showing an empty picker.
  useEffect(() => {
    let active = true;
    fetchChains()
      .then((chains) => {
        if (active) dispatch({ type: 'chains/loaded', chains });
      })
      .catch(() => {
        if (active) dispatch({ type: 'chains/loaded', chains: fallbackChains() });
      });
    return () => {
      active = false;
    };
  }, []);

  const runTrace = useCallback(
    async (input: TraceInput) => {
      clearTimers();
      const at = Date.now();
      const runId = runIdRef.current + 1;
      runIdRef.current = runId;
      dispatch({ type: 'run/start', input, at });

      const stages = ['tracing', 'attributing', 'assessing'] as const;
      STAGE_DELAYS.forEach((delay, index) => {
        const id = window.setTimeout(() => {
          dispatch({ type: 'run/stage', stage: stages[index] });
        }, delay);
        timers.current.push(id);
      });

      try {
        const result = await submitTrace(input);
        clearTimers();
        dispatch({ type: 'run/resolve', runId, result, at: Date.now() });
      } catch (error) {
        clearTimers();
        const message =
          error instanceof Error ? error.message : 'The trace service could not be reached.';
        dispatch({ type: 'run/fail', runId, message, at: Date.now() });
      }
    },
    [clearTimers],
  );

  const actions = {
    runTrace,
    reset: useCallback(() => {
      clearTimers();
      dispatch({ type: 'run/reset' });
    }, [clearTimers]),
    select: useCallback((selection: Selection | null) => dispatch({ type: 'select', selection }), []),
    setFilter: useCallback((filter: GraphFilter) => dispatch({ type: 'filter/set', filter }), []),
    setMode: useCallback((mode: GraphMode) => dispatch({ type: 'mode/set', mode }), []),
    setSearch: useCallback((value: string) => dispatch({ type: 'search/set', value }), []),
    setPage: useCallback((page: number) => dispatch({ type: 'page/set', page }), []),
    setChain: useCallback((chain: string) => dispatch({ type: 'chain/select', chain }), []),
    requestFocus: useCallback(
      (request: FocusRequest | null) => dispatch({ type: 'focus/request', request }),
      [],
    ),
    toggleRail: useCallback(() => dispatch({ type: 'rail/toggle' }), []),
    setRail: useCallback((open: boolean) => dispatch({ type: 'rail/set', open }), []),
  };

  return { state, actions } as { state: InvestigationState; actions: typeof actions };
}
