import type { GraphFilter, GraphMode, FocusRequest, Selection } from '../lib/graph';
import type { ChainInfo, TraceInput, TraceResult } from '../types';

/**
 * Central investigation state.
 *
 * One reducer owns the whole case: the request that was made, the stage it is in,
 * the result, and every view decision (filter, mode, selection, search, page).
 * Components receive slices and dispatch intents — nothing keeps a private copy of
 * the result, so the graph, ledger and inspectors can never disagree.
 */

export type Stage = 'idle' | 'validating' | 'tracing' | 'attributing' | 'assessing' | 'settled';

export type RunState = 'idle' | 'running' | 'completed' | 'partial' | 'failed';

/** Ordered stages shown in the console. The last one completes with the response. */
export const STAGES: { id: Exclude<Stage, 'idle' | 'settled'>; label: string; detail: string }[] = [
  { id: 'validating', label: 'Validating', detail: 'Address format and chain resolution.' },
  { id: 'tracing', label: 'Tracing', detail: 'Collecting on-chain transfers hop by hop.' },
  { id: 'attributing', label: 'Attributing', detail: 'Resolving addresses to known entities.' },
  { id: 'assessing', label: 'Assessing', detail: 'Weighting risk signals and preparing findings.' },
];

export const LEDGER_PAGE_SIZE = 100;

export interface InvestigationState {
  run: RunState;
  stage: Stage;
  request: TraceInput | null;
  result: TraceResult | null;
  error: string | null;
  startedAt: number | null;
  completedAt: number | null;
  elapsedMs: number | null;
  /** Chain selected in the console, kept visible after a run. */
  selectedChain: string;
  chains: ChainInfo[];
  filter: GraphFilter;
  mode: GraphMode;
  selection: Selection | null;
  search: string;
  page: number;
  focusRequest: FocusRequest | null;
  railOpen: boolean;
  /** Guards against a stale response overwriting a newer run. */
  runId: number;
}

export const initialInvestigationState: InvestigationState = {
  run: 'idle',
  stage: 'idle',
  request: null,
  result: null,
  error: null,
  startedAt: null,
  completedAt: null,
  elapsedMs: null,
  selectedChain: 'all',
  chains: [],
  filter: 'all',
  mode: 'DEFAULT',
  selection: null,
  search: '',
  page: 0,
  focusRequest: null,
  // Open on load: the target panel is the entry point to a case, so it is never
  // something the investigator has to go and uncover.
  railOpen: true,
  runId: 0,
};

export type InvestigationAction =
  | { type: 'chains/loaded'; chains: ChainInfo[] }
  | { type: 'run/start'; input: TraceInput; at: number }
  | { type: 'run/stage'; stage: Stage }
  | { type: 'run/resolve'; runId: number; result: TraceResult; at: number }
  | { type: 'run/fail'; runId: number; message: string; at: number }
  | { type: 'run/reset' }
  | { type: 'select'; selection: Selection | null }
  | { type: 'filter/set'; filter: GraphFilter }
  | { type: 'mode/set'; mode: GraphMode }
  | { type: 'search/set'; value: string }
  | { type: 'page/set'; page: number }
  | { type: 'chain/select'; chain: string }
  | { type: 'focus/request'; request: FocusRequest | null }
  | { type: 'rail/toggle' }
  | { type: 'rail/set'; open: boolean };

export function investigationReducer(
  state: InvestigationState,
  action: InvestigationAction,
): InvestigationState {
  switch (action.type) {
    case 'chains/loaded':
      return { ...state, chains: action.chains };

    case 'run/start':
      return {
        ...state,
        run: 'running',
        stage: 'validating',
        request: action.input,
        result: null,
        error: null,
        startedAt: action.at,
        completedAt: null,
        elapsedMs: null,
        selectedChain: action.input.chain || 'all',
        selection: null,
        search: '',
        page: 0,
        filter: 'all',
        mode: 'DEFAULT',
        focusRequest: null,
        runId: state.runId + 1,
      };

    case 'run/stage':
      return state.run === 'running' ? { ...state, stage: action.stage } : state;

    case 'run/resolve': {
      if (action.runId !== state.runId) return state;
      const status = (action.result.status || '').toLowerCase();
      // A FAILED trace used to land here as a green "Completed" case with an empty
      // canvas and the real error buried in the record. Surface it as a failure with
      // the service's own reason so a retry is one glance away.
      if (status === 'failed') {
        return {
          ...state,
          run: 'failed',
          stage: 'settled',
          result: action.result,
          error: action.result.failureReason || 'The trace service failed this investigation.',
          completedAt: action.at,
          elapsedMs: action.at - (state.startedAt ?? action.at),
        };
      }
      // The backend can complete a trace with missing coverage. Surface that as a
      // distinct state instead of presenting a partial graph as complete.
      const partial = status === 'partial';
      return {
        ...state,
        run: partial ? 'partial' : 'completed',
        stage: 'settled',
        result: action.result,
        error: null,
        completedAt: action.at,
        elapsedMs: action.at - (state.startedAt ?? action.at),
      };
    }

    case 'run/fail':
      if (action.runId !== state.runId) return state;
      return {
        ...state,
        run: 'failed',
        stage: 'settled',
        result: null,
        error: action.message,
        completedAt: action.at,
        elapsedMs: action.at - (state.startedAt ?? action.at),
      };

    case 'run/reset':
      return {
        ...initialInvestigationState,
        chains: state.chains,
        selectedChain: state.selectedChain,
      };

    case 'select':
      // A new selection invalidates a search-scoped ledger filter only if it
      // conflicts; keep the search, it is an independent investigator control.
      return { ...state, selection: action.selection, page: 0 };

    case 'filter/set':
      return { ...state, filter: action.filter, page: 0 };

    case 'mode/set':
      return { ...state, mode: action.mode };

    case 'search/set':
      return { ...state, search: action.value, page: 0 };

    case 'page/set':
      return { ...state, page: Math.max(0, action.page) };

    case 'chain/select':
      return { ...state, selectedChain: action.chain };

    case 'focus/request':
      return { ...state, focusRequest: action.request };

    case 'rail/toggle':
      return { ...state, railOpen: !state.railOpen };

    case 'rail/set':
      return { ...state, railOpen: action.open };

    default:
      return state;
  }
}

/* ── Derived helpers ───────────────────────────────────────────────────── */

export function statusBadgeClass(run: RunState): string {
  switch (run) {
    case 'running':
      return 'status-badge busy';
    case 'completed':
      return 'status-badge live';
    case 'partial':
      return 'status-badge partial';
    case 'failed':
      return 'status-badge failed';
    default:
      return 'status-badge idle';
  }
}

export function statusLabel(run: RunState): string {
  switch (run) {
    case 'running':
      return 'Running';
    case 'completed':
      return 'Completed';
    case 'partial':
      return 'Partial';
    case 'failed':
      return 'Failed';
    default:
      return 'No active case';
  }
}

/** The case reference shown in the masthead: what the investigator typed, else the trace id. */
export function caseReference(state: InvestigationState): string | null {
  if (state.request?.caseId?.trim()) return state.request.caseId.trim();
  if (state.result?.caseId?.trim()) return state.result.caseId.trim();
  return null;
}

/** Stable, human-facing case identity. Falls back to a short trace id. */
export function displayCaseId(state: InvestigationState): string {
  const explicit = caseReference(state);
  if (explicit) return explicit;
  if (state.result?.id) return `TR-${state.result.id.slice(0, 8).toUpperCase()}`;
  return '—';
}
