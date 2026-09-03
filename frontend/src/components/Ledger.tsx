import type { TraceResult } from '../types';
import { copy, eth, shortAddr, when } from '../format';

interface Props {
  result: TraceResult;
  focus: string | null;
  onClearFocus: () => void;
}

export default function Ledger({ result, focus, onClearFocus }: Props) {
  const lower = focus?.toLowerCase();
  const rows = result.edges
    .filter((e) => !lower || e.fromAddress.toLowerCase() === lower || e.toAddress.toLowerCase() === lower)
    .slice()
    .sort((a, b) => (a.txTimestamp ?? '').localeCompare(b.txTimestamp ?? ''));

  return (
    <div className="ledger-shell">
      <div className="ledger-head">
        <h3>Transfers</h3>
        <span className="ledger-count">
          {rows.length} of {result.edges.length}
          {focus ? ` touching ${shortAddr(focus)}` : ''}
        </span>
        {focus && (
          <button className="link-button" type="button" onClick={onClearFocus}>
            Show all
          </button>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="ledger-empty">No transfers recorded for this selection.</p>
      ) : (
        <table className="ledger">
          <thead>
            <tr>
              <th>From</th>
              <th>To</th>
              <th style={{ textAlign: 'right' }}>Amount</th>
              <th>Time</th>
              <th>Transaction</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((e) => (
              <tr key={e.txHash + e.toAddress}>
                <td className="cell-mono">{shortAddr(e.fromAddress)}</td>
                <td className="cell-mono">{shortAddr(e.toAddress)}</td>
                <td className="cell-num">{eth(e.amount)} ETH</td>
                <td>{when(e.txTimestamp)}</td>
                <td className="cell-mono">
                  {shortAddr(e.txHash)}{' '}
                  <button className="copy-chip" type="button" onClick={() => copy(e.txHash)}>
                    Copy
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
