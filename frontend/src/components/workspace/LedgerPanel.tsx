import { useMemo } from 'react';
import { ChevronLeft, ChevronRight, Search, TriangleAlert, X } from 'lucide-react';
import { LEDGER_PAGE_SIZE } from '../../state/investigationReducer';
import { entityMeta } from '../../lib/entities';
import { displaySymbol, symbolAdvisory, symbolAdvisoryText } from '../../lib/symbols';
import type { GraphView, Selection } from '../../lib/graph';
import { shortenAddress, shortenHash } from '../../format';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';

/**
 * The transfer ledger.
 *
 * Every transfer in the trace, filtered and searched, with the currently selected
 * address scoped in. Selection and search are independent controls on purpose: an
 * investigator narrowing a case by hash and an investigator following one address are
 * different jobs, and conflating them loses one of them.
 */

interface Props {
  view: GraphView;
  selection: Selection | null;
  search: string;
  onSearch: (value: string) => void;
  page: number;
  onPage: (page: number) => void;
  onSelect: (id: string, kind: 'node' | 'edge') => void;
  onClearSelection: () => void;
}

export default function LedgerPanel({
  view,
  selection,
  search,
  onSearch,
  page,
  onPage,
  onSelect,
  onClearSelection,
}: Props) {
  /* Debounced so a fast typist is not re-filtering 200 rows on every keystroke, while
     the input itself stays fully controlled and responsive. */
  const debounced = useDebouncedValue(search, 180);

  const scoped = useMemo(() => {
    let edges = view.edges;
    if (selection?.kind === 'node') {
      const address = selection.address.toLowerCase();
      edges = edges.filter((e) => e.source === address || e.target === address);
    }
    return edges;
  }, [view.edges, selection]);

  const filtered = useMemo(() => {
    const q = debounced.trim().toLowerCase();
    if (!q) return scoped;
    return scoped.filter((e) => {
      const asset = (e.edge.tokenSymbol || '').toLowerCase();
      return (
        e.source.includes(q) ||
        e.target.includes(q) ||
        e.edge.txHash.toLowerCase().includes(q) ||
        asset.includes(q)
      );
    });
  }, [scoped, debounced]);

  const pages = Math.max(1, Math.ceil(filtered.length / LEDGER_PAGE_SIZE));
  const current = Math.min(page, pages - 1);
  const rows = filtered.slice(current * LEDGER_PAGE_SIZE, (current + 1) * LEDGER_PAGE_SIZE);

  const selectedAddress = selection?.kind === 'node' ? selection.address.toLowerCase() : null;

  return (
    <section className="ledger-panel" aria-label="Transfer ledger">
      <div className="ledger-header">
        <div className="ledger-title-group">
          <h2 className="card-title">Transfer ledger</h2>
          <span className="tagline">
            {filtered.length} of {view.edges.length} transfers
          </span>
        </div>

        <div className="ledger-controls">
          {selectedAddress ? (
            <span className="ledger-filter-chip">
              {entityMeta(view.byAddress.get(selectedAddress)?.labelType ?? null).short} ·{' '}
              {shortenAddress(selectedAddress)}
              <button type="button" onClick={onClearSelection} aria-label="Clear the selected address">
                <X size={11} aria-hidden />
              </button>
            </span>
          ) : null}

          <div className="search-box">
            <Search size={13} className="search-icon" aria-hidden />
            <input
              className="search-input"
              value={search}
              onChange={(event) => onSearch(event.target.value)}
              placeholder="Address, tx hash or asset"
              aria-label="Search the transfer ledger"
              spellCheck={false}
              autoComplete="off"
            />
            {search ? (
              <button
                type="button"
                className="search-icon"
                onClick={() => onSearch('')}
                aria-label="Clear the search"
                style={{ position: 'static' }}
              >
                <X size={12} aria-hidden />
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="ledger-table-wrapper">
        <table className="ledger-table">
          <thead>
            <tr>
              <th scope="col">From</th>
              <th scope="col">To</th>
              <th scope="col">Amount</th>
              <th scope="col">Asset (self-declared)</th>
              <th scope="col">Transaction</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5}>
                  <p className="ledger-empty">
                    {debounced
                      ? `No transfer matches “${debounced}”.`
                      : 'No transfers in scope for this selection.'}
                  </p>
                </td>
              </tr>
            ) : (
              rows.map((edge) => {
                const fromMeta = entityMeta(view.byAddress.get(edge.source)?.labelType ?? null);
                const toMeta = entityMeta(view.byAddress.get(edge.target)?.labelType ?? null);
                const isSelected = selection?.kind === 'edge' && selection.id === edge.id;
                const advisory = symbolAdvisory(edge.edge.tokenSymbol);
                const symbol = displaySymbol(edge.edge.tokenSymbol);
                return (
                  <tr
                    key={edge.id}
                    className={`ledger-row${
                      isSelected ? ' ledger-row--selected' : ''
                    }${
                      selectedAddress && (edge.source === selectedAddress || edge.target === selectedAddress)
                        ? ' ledger-row--focused'
                        : ''
                    }`}
                    role="button"
                    tabIndex={0}
                    aria-pressed={isSelected}
                    aria-label={`Select transfer of ${formatQuantity(edge.amount)} ${symbol} from ${shortenAddress(edge.source)} to ${shortenAddress(edge.target)}`}
                    onClick={() => onSelect(edge.id, 'edge')}
                    onKeyDown={(event) => {
                      if (event.key !== 'Enter' && event.key !== ' ') return;
                      event.preventDefault();
                      onSelect(edge.id, 'edge');
                    }}
                  >
                    <td>
                      <span className="token-chip" style={{ color: fromMeta.color }}>
                        {fromMeta.glyph} {shortenAddress(edge.source)}
                      </span>
                    </td>
                    <td>
                      <span className="token-chip" style={{ color: toMeta.color }}>
                        {toMeta.glyph} {shortenAddress(edge.target)}
                      </span>
                    </td>
                    <td className="amount-cell">{formatQuantity(edge.amount)}</td>
                    <td>
                      <span
                        className="token-chip"
                        title={advisory ? symbolAdvisoryText(advisory) : undefined}
                      >
                        {advisory ? (
                          <TriangleAlert size={10} aria-hidden className="token-chip__warn" />
                        ) : null}
                        {displaySymbol(edge.edge.tokenSymbol)}
                      </span>
                    </td>
                    <td>
                      <span className="tagline">{shortenHash(edge.edge.txHash)}</span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {pages > 1 ? (
        <div className="ledger-pager">
          <span className="tagline">
            Page {current + 1} of {pages}
          </span>
          <div className="ledger-pager__buttons">
            <button
              type="button"
              className="ctrl-btn"
              onClick={() => onPage(Math.max(0, current - 1))}
              disabled={current === 0}
              aria-label="Previous page"
            >
              <ChevronLeft size={14} aria-hidden />
            </button>
            <button
              type="button"
              className="ctrl-btn"
              onClick={() => onPage(Math.min(pages - 1, current + 1))}
              disabled={current >= pages - 1}
              aria-label="Next page"
            >
              <ChevronRight size={14} aria-hidden />
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

/**
 * Quantities arrive as strings from the backend. Grouping separators are added only
 * when the value is a plain number — anything else is shown verbatim rather than
 * mangled. The asset lives in its own column, so no symbol is appended here.
 */
function formatQuantity(value: string | number): string {
  const raw = typeof value === 'number' ? String(value) : value;
  if (!/^\d+(\.\d+)?$/.test(raw)) return raw;
  const [whole, fraction] = raw.split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return fraction ? `${grouped}.${fraction}` : grouped;
}
