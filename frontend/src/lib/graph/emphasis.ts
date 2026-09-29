import { findPathTo, isKnownLabel, type GraphMode, type GraphView, type Selection } from './model';

/**
 * Emphasis.
 *
 * Filtering hides elements. Emphasis keeps everything on the canvas and changes how
 * much attention each element earns, because an investigator asking "how did funds get
 * from here to there" needs the rest of the graph to still be there for context.
 *
 * Three tiers, as the visual brief requires:
 *
 *   focus     the selected element and the path it belongs to   full opacity
 *   adjacent  the immediate neighbourhood, kept for context     partial
 *   unrelated everything else                                    heavily subdued
 *
 * Nothing is removed and nothing is mutated: this is a set of ids that the canvas
 * turns into style classes.
 */

export type EmphasisTier = 'focus' | 'adjacent' | 'unrelated' | 'none';

export interface Emphasis {
  tier: (id: string) => EmphasisTier;
  focus: Set<string>;
  adjacent: Set<string>;
  /** Edges lifted to full contrast. */
  highlightEdges: Set<string>;
  /** A one-line explanation of what is emphasised, for the mode readout. */
  note: string | null;
}

const NONE: Emphasis = {
  tier: () => 'none',
  focus: new Set(),
  adjacent: new Set(),
  highlightEdges: new Set(),
  note: null,
};

/** The address a mode should pivot on, or null when nothing is selected. */
function pivot(selection: Selection | null): string | null {
  if (!selection) return null;
  return selection.kind === 'node' ? selection.address : null;
}

export function buildEmphasis(
  view: GraphView,
  mode: GraphMode,
  selection: Selection | null,
): Emphasis {
  /* DEFAULT must never dim anything. An investigator who has not chosen a mode is not
     looking at a graph that has quietly hidden half of itself. */
  if (mode === 'DEFAULT') return NONE;

  const target = pivot(selection);
  if (!target) {
    /* With no selection, the modes still have to mean something. They fall back to the
       whole graph: the reported wallet, and whatever the service flagged. */
    return emphasisWithoutSelection(view, mode);
  }

  const focus = new Set<string>();
  const adjacent = new Set<string>();
  const highlightEdges = new Set<string>();

  if (mode === 'PATH_FOCUS') {
    const path = findPathTo(view, target);
    if (path.length === 0) {
      /* No directed path from the reported wallet. Falling back to neighbourhood focus
         is honest; showing an empty "path" would not be. */
      return neighbourhood(view, target, 'No directed path from the reported wallet to this address within the traced subgraph. Showing its direct counterparties instead.');
    }
    path.forEach((id) => focus.add(id));
    for (let i = 0; i < path.length - 1; i += 1) {
      const source = path[i];
      const targetId = path[i + 1];
      view.edges
        .filter((e) => e.source === source && e.target === targetId)
        .forEach((e) => highlightEdges.add(e.id));
    }
    return {
      tier: (id) => (focus.has(id) ? 'focus' : 'unrelated'),
      focus,
      adjacent,
      highlightEdges,
      note: `Computed path of ${path.length - 1} hop${path.length === 2 ? '' : 's'} from the reported wallet.`,
    };
  }

  if (mode === 'ENTITY_FOCUS') {
    /* The target's neighbourhood, plus every resolved entity, so the investigator can
       see where a known entity sits relative to where they clicked. */
    view.edges.forEach((e) => {
      if (e.source === target) adjacent.add(e.target);
      if (e.target === target) adjacent.add(e.source);
    });
    view.nodes.forEach((n) => {
      if (isKnownLabel(n.labelType)) adjacent.add(n.id);
    });
    focus.add(target);
    view.edges
      .filter((e) => e.source === target || e.target === target)
      .forEach((e) => highlightEdges.add(e.id));
    return {
      tier: (id) => (focus.has(id) ? 'focus' : adjacent.has(id) ? 'adjacent' : 'unrelated'),
      focus,
      adjacent,
      highlightEdges,
      note: 'Resolved entities and the selected address’s direct counterparties.',
    };
  }

  // RISK_FOCUS
  focus.add(target);
  view.edges.forEach((e) => {
    if (e.source === target || e.target === target) adjacent.add(e.target);
    if (e.source === target || e.target === target) adjacent.add(e.source);
  });
  view.nodes.forEach((n) => {
    if (n.isRisk || n.onKeyPath) adjacent.add(n.id);
  });
  view.edges
    .filter((e) => e.isRisk)
    .forEach((e) => {
      highlightEdges.add(e.id);
      adjacent.add(e.source);
      adjacent.add(e.target);
    });
  return {
    tier: (id) => (focus.has(id) ? 'focus' : adjacent.has(id) ? 'adjacent' : 'unrelated'),
    focus,
    adjacent,
    highlightEdges,
    note: 'Mixer, sanctioned and service-flagged elements, plus the selected address.',
  };
}

function neighbourhood(view: GraphView, target: string, note: string): Emphasis {
  const focus = new Set([target]);
  const adjacent = new Set<string>();
  const highlightEdges = new Set<string>();
  view.edges.forEach((e) => {
    if (e.source === target) adjacent.add(e.target);
    if (e.target === target) adjacent.add(e.source);
  });
  view.edges
    .filter((e) => e.source === target || e.target === target)
    .forEach((e) => highlightEdges.add(e.id));
  return {
    tier: (id) => (focus.has(id) ? 'focus' : adjacent.has(id) ? 'adjacent' : 'unrelated'),
    focus,
    adjacent,
    highlightEdges,
    note,
  };
}

function emphasisWithoutSelection(view: GraphView, mode: GraphMode): Emphasis {
  const root = view.rootAddress;
  const hasRisk = view.nodes.some((n) => n.isRisk);
  const hasKeyPath = view.edges.some((e) => e.onKeyPath);

  if (mode === 'RISK_FOCUS' && (hasRisk || hasKeyPath)) {
    const focus = new Set<string>();
    const adjacent = new Set<string>();
    const highlightEdges = new Set<string>();
    view.nodes.forEach((n) => {
      if (n.isRisk) focus.add(n.id);
      else if (n.onKeyPath) adjacent.add(n.id);
    });
    view.edges.forEach((e) => {
      if (e.isRisk) {
        highlightEdges.add(e.id);
        adjacent.add(e.source);
        adjacent.add(e.target);
      }
    });
    if (focus.size === 0) {
      view.nodes.filter((n) => n.onKeyPath).forEach((n) => focus.add(n.id));
    }
    if (root) focus.add(root);
    return {
      tier: (id) => (focus.has(id) ? 'focus' : adjacent.has(id) ? 'adjacent' : 'unrelated'),
      focus,
      adjacent,
      highlightEdges,
      note: 'Every mixer, sanctioned address and service-flagged element in this trace.',
    };
  }

  if (mode === 'PATH_FOCUS' && hasKeyPath) {
    const focus = new Set<string>();
    const highlightEdges = new Set<string>();
    for (const path of view.keyPaths) {
      path.addresses.map((a) => a.toLowerCase()).forEach((a) => focus.add(a));
    }
    view.edges.filter((e) => e.onKeyPath).forEach((e) => highlightEdges.add(e.id));
    return {
      tier: (id) => (focus.has(id) ? 'focus' : 'unrelated'),
      focus,
      adjacent: new Set(),
      highlightEdges,
      note: 'The path the service flagged as a cash-out route.',
    };
  }

  if (mode === 'ENTITY_FOCUS') {
    const known = view.nodes.filter((n) => isKnownLabel(n.labelType));
    if (known.length > 0) {
      const focus = new Set(known.map((n) => n.id));
      const adjacent = new Set<string>();
      view.edges.forEach((e) => {
        if (focus.has(e.source) || focus.has(e.target)) {
          adjacent.add(e.source);
          adjacent.add(e.target);
        }
      });
      if (root) focus.add(root);
      return {
        tier: (id) => (focus.has(id) ? 'focus' : adjacent.has(id) ? 'adjacent' : 'unrelated'),
        focus,
        adjacent,
        highlightEdges: new Set(),
        note: `All ${known.length} addresses the service resolved to a known entity. Select one to trace its path.`,
      };
    }
  }

  if (mode === 'PATH_FOCUS') {
    return { ...NONE, note: 'Select an address to compute a path. This trace reported no cash-out path.' };
  }

  return { ...NONE, note: 'Select an address to focus its risk context.' };
}
