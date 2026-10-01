import { useMemo, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
<<<<<<< HEAD
import { ChevronLeft, ChevronRight, Search, TriangleAlert, X } from 'lucide-react';
=======
import { Search, TriangleAlert, X } from 'lucide-react';
>>>>>>> origin/main
import { entityMeta } from '../../lib/entities';
import { symbolAdvisory, symbolAdvisoryText } from '../../lib/symbols';
import type { GraphView, Selection } from '../../lib/graph';
import { shortenAddress, shortenHash } from '../../format';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';

/**
 * The transfer ledger.
 *
 * Every transfer in the trace, filtered and searched, with the currently selected
 * address scoped in. Selection and search are independent controls on purpose.
 */

interface Props {
  view: GraphView;
  selection: Selection | null;
  search: string;
  onSearch: (value: string) => void;
  page: number; // Keeping for compatibility with parent components, though unused by virtualizer
  onPage: (page: number) => void;
  onSelect: (id: string, kind: 'node' | 'edge') => void;
  onClearSelection: () => void;
}

export default function LedgerPanel({
  view,
  selection,
  search,
  onSearch,
  onSelect,
  onClearSelection,
}: Props) {
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
      const asset = (e.assetLabel || '').toLowerCase();
      const hasTxMatch = e.transfers.some((t) => t.txHash.toLowerCase().includes(q));
      return (
        e.source.includes(q) ||
        e.target.includes(q) ||
        hasTxMatch ||
        asset.includes(q)
      );
    });
  }, [scoped, debounced]);

  const selectedAddress = selection?.kind === 'node' ? selection.address.toLowerCase() : null;

  // Virtualization setup
  const parentRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 29, // Approximate row height
    overscan: 10,
  });

  const virtualItems = rowVirtualizer.getVirtualItems();
  const paddingTop = virtualItems.length > 0 ? virtualItems[0].start : 0;
  const paddingBottom =
    virtualItems.length > 0
      ? rowVirtualizer.getTotalSize() - virtualItems[virtualItems.length - 1].end
      : 0;

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

      <div className="ledger-table-wrapper" ref={parentRef}>
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
            {filtered.length === 0 ? (
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
              <>
                {paddingTop > 0 && (
                  <tr>
                    <td style={{ height: `${paddingTop}px` }} colSpan={5} />
                  </tr>
                )}
                {virtualItems.map((virtualRow) => {
                  const edge = filtered[virtualRow.index];
                  const fromMeta = entityMeta(view.byAddress.get(edge.source)?.labelType ?? null);
                  const toMeta = entityMeta(view.byAddress.get(edge.target)?.labelType ?? null);
                  const isSelected = selection?.kind === 'edge' && selection.id === edge.id;
<<<<<<< HEAD
                  const advisory = symbolAdvisory(edge.edge.tokenSymbol);
                  const symbol = displaySymbol(edge.edge.tokenSymbol);
=======
                  const advisory = symbolAdvisory(edge.isNative ? null : edge.assetLabel);
                  const symbol = edge.assetLabel;
                  const firstTx = edge.transfers[0]?.txHash ?? '';
>>>>>>> origin/main
                  return (
                    <tr
                      key={edge.id}
                      data-index={virtualRow.index}
                      ref={rowVirtualizer.measureElement}
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
<<<<<<< HEAD
                      aria-label={`Select transfer of ${formatQuantity(edge.amount)} ${symbol} from ${shortenAddress(edge.source)} to ${shortenAddress(edge.target)}`}
=======
                      aria-label={`Select transfer of ${formatQuantity(edge.totalAmount)} ${symbol} from ${shortenAddress(edge.source)} to ${shortenAddress(edge.target)}`}
>>>>>>> origin/main
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
<<<<<<< HEAD
                      <td className="amount-cell">{formatQuantity(edge.amount)}</td>
=======
                      <td className="amount-cell">{formatQuantity(edge.totalAmount)}</td>
>>>>>>> origin/main
                      <td>
                        <span
                          className="token-chip"
                          title={advisory ? symbolAdvisoryText(advisory) : undefined}
                        >
                          {advisory ? (
                            <TriangleAlert size={10} aria-hidden className="token-chip__warn" />
                          ) : null}
<<<<<<< HEAD
                          {displaySymbol(edge.edge.tokenSymbol)}
                        </span>
                      </td>
                      <td>
                        <span className="tagline">{shortenHash(edge.edge.txHash)}</span>
=======
                          {symbol}
                        </span>
                      </td>
                      <td>
                        <span className="tagline">
                          {edge.transferCount === 1 ? shortenHash(firstTx) : `${edge.transferCount} txs`}
                        </span>
>>>>>>> origin/main
                      </td>
                    </tr>
                  );
                })}
                {paddingBottom > 0 && (
                  <tr>
                    <td style={{ height: `${paddingBottom}px` }} colSpan={5} />
                  </tr>
                )}
              </>
            )}
          </tbody>
        </table>
      </div>
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
