import { useCallback, useMemo } from 'react';
import { useInvestigation } from '../hooks/useInvestigation';
import { buildGraphView, matchesFilter, pathNodeSet } from '../lib/graph';
import TargetPanel from '../components/workspace/TargetPanel';
import CaseBriefing from '../components/workspace/CaseBriefing';
import GraphPanel from '../components/workspace/GraphPanel';
import LedgerPanel from '../components/workspace/LedgerPanel';
import EntityInspector from '../components/workspace/EntityInspector';
import WorkspaceMasthead from '../components/workspace/WorkspaceMasthead';
import { statusBadgeClass, statusLabel, displayCaseId } from '../state/investigationReducer';

/**
 * The workstation.
 *
 * One page owns the investigation; every panel is a pure function of the reducer's
 * state. That is the architectural claim of the redesign: the graph, the ledger, the
 * inspector and the risk breakdown are four views of one case, so they cannot drift
 * apart. This file derives views and dispatches intents — it holds no case data itself.
 */
export default function Workspace() {
  const { state, actions } = useInvestigation();
  const { result, selection, mode, filter, focusRequest } = state;

  const view = useMemo(() => (result ? buildGraphView(result) : null), [result]);

  /**
   * Emphasis set — which node ids stay lit for the current mode.
   *
   * DEFAULT keeps everything lit, so an investigator who has not chosen a mode is
   * never looking at a graph that has silently hidden part of itself.
   */
  const emphasis = useMemo<Set<string> | null>(() => {
    if (!view || mode === 'DEFAULT') return null;
    const target =
      selection?.kind === 'node'
        ? selection.address.toLowerCase()
        : selection?.kind === 'edge'
          ? view.edges.find((e) => e.id === selection.id)?.target.toLowerCase() ?? null
          : null;
    if (!target) return null;

    if (mode === 'PATH_FOCUS') return pathNodeSet(view, target);

    const set = new Set<string>([target]);
    if (mode === 'ENTITY_FOCUS') {
      view.edges.forEach((e) => {
        if (e.source === target) set.add(e.target);
        if (e.target === target) set.add(e.source);
      });
    }
    return set;
  }, [view, mode, selection]);

  /** Edges drawn in the accent colour: the traced path, or the selection's own edge. */
  const highlightEdges = useMemo<Set<string> | null>(() => {
    if (!view) return null;
    if (mode === 'PATH_FOCUS' && emphasis && selection?.kind === 'node') {
      return new Set(
        view.edges
          .filter((e) => emphasis.has(e.source) && emphasis.has(e.target))
          .map((e) => e.id),
      );
    }
    if (selection?.kind === 'edge') return new Set([selection.id]);
    return null;
  }, [view, mode, emphasis, selection]);

  /** Node ids removed from the drawing by the active filter. */
  const hidden = useMemo(() => {
    if (!view || filter === 'all') return null;
    const set = new Set<string>();
    view.nodes.forEach((node) => {
      if (!matchesFilter(node, filter)) set.add(node.id);
    });
    return set.size > 0 ? set : null;
  }, [view, filter]);

  const selectedId =
    selection?.kind === 'node'
      ? selection.address.toLowerCase()
      : selection?.kind === 'edge'
        ? selection.id
        : null;

  /** Selecting from any panel routes through here so the graph, ledger and inspector
   *  are always describing the same element. */
  const onSelect = useCallback(
    (id: string, kind: 'node' | 'edge') => {
      if (!id || !view) {
        actions.select(null);
        return;
      }
      if (kind === 'node') {
        actions.select({ kind: 'node', address: id });
        return;
      }
      if (kind === 'edge') {
        actions.select({ kind: 'edge', id });
      }
    },
    [actions, view],
  );

  /** Selecting a different element moves the viewport with it, so a click in the
   *  ledger or the inspector is never invisible on the canvas. */
  const onFocus = useCallback(
    (id: string, kind: 'node' | 'edge') => {
      onSelect(id, kind);
      actions.requestFocus({ type: kind, id, nonce: Date.now() });
    },
    [actions, onSelect],
  );

  const clearFocus = useCallback(() => actions.requestFocus(null), [actions]);
  const clearSelection = useCallback(() => actions.select(null), [actions]);

  const hasGraph = Boolean(view && view.nodes.length > 0);

  return (
    <div className="app-container">
      {/* The panels carry h2s; the page itself still needs one h1 so a screen reader
          announces the workspace rather than an unlabelled region. */}
      <h1 className="sr-only">Investigation workstation</h1>
      <WorkspaceMasthead
        statusClass={statusBadgeClass(state.run)}
        statusLabel={statusLabel(state.run)}
        chain={state.selectedChain}
        result={result}
        caseId={displayCaseId(state)}
        onToggleRail={actions.toggleRail}
      />

      <div className="workspace-body">
        <aside
          className={`sidebar-rail${state.railOpen ? '' : ' sidebar-rail--hidden'}`}
          aria-label="Case controls and findings"
        >
          <TargetPanel
            chains={state.chains}
            selectedChain={state.selectedChain}
            onChainChange={actions.setChain}
            onRun={actions.runTrace}
            onReset={actions.reset}
            run={state.run}
            stage={state.stage}
            elapsedMs={state.elapsedMs}
            error={state.error}
          />

          {result ? <CaseBriefing result={result} elapsedMs={state.elapsedMs} /> : null}
        </aside>

        <div className="canvas-workspace">
          <GraphPanel
            view={view}
            emphasis={emphasis}
            highlightEdges={highlightEdges}
            hidden={hidden}
            filter={filter}
            mode={mode}
            selectedId={selectedId}
            onSelect={onSelect}
            onFilter={actions.setFilter}
            onMode={actions.setMode}
            focusRequest={focusRequest}
            onConsumedFocus={clearFocus}
            run={state.run}
            stage={state.stage}
            selectedChain={state.selectedChain}
            error={state.error}
            hasGraph={hasGraph}
          />

          {hasGraph && view ? (
            <LedgerPanel
              view={view}
              selection={selection}
              search={state.search}
              onSearch={actions.setSearch}
              page={state.page}
              onPage={actions.setPage}
              onSelect={onSelect}
              onClearSelection={clearSelection}
            />
          ) : null}
        </div>

        {view ? (
          <EntityInspector
            view={view}
            selection={selection}
            chain={state.selectedChain}
            onClose={clearSelection}
            onFocus={onFocus}
          />
        ) : null}
      </div>
    </div>
  );
}
