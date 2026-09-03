import type { TraceResult } from '../types';
import { copy, shortAddr, when } from '../format';

export function Attribution({ result }: { result: TraceResult }) {
  const ex = result.nearestExchange;
  return (
    <section className="block">
      <h2 className="block-title">Where the money landed</h2>
      {ex ? (
        <div className="attribution">
          <div className="attribution-entity">{ex.entity ?? 'Unnamed exchange'}</div>
          <div className="attribution-meta">
            Receives deposits {ex.hopDepth} {ex.hopDepth === 1 ? 'hop' : 'hops'} from the reported
            wallet. Serve the disclosure request here.
          </div>
          <div className="attribution-addr">
            <span>{ex.address}</span>
            <button className="copy-chip" type="button" onClick={() => copy(ex.address)}>
              Copy
            </button>
          </div>
        </div>
      ) : (
        <p className="attribution-none">
          No exchange reached within {result.hopsTraced ?? 0} hops. The funds are still sitting in
          unlabelled wallets, or they left through a service that is not in the label set yet.
        </p>
      )}
    </section>
  );
}

export function RiskStamp({ result }: { result: TraceResult }) {
  if (result.riskScore == null) return null;
  const band = result.riskCategory ?? 'LOW';
  const reasons = (result.flaggedPatterns ?? '').split('|').map((r) => r.trim()).filter(Boolean);

  return (
    <section className="block">
      <h2 className="block-title">Risk assessment</h2>
      <div className="stamp-wrap">
        <div className={`stamp risk-${band}`}>
          <div className="stamp-score">{result.riskScore}</div>
          <div className="stamp-band">{band}</div>
        </div>
      </div>
      <ul className="reasons">
        {reasons.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>
    </section>
  );
}

export function CaseFacts({ result }: { result: TraceResult }) {
  return (
    <section className="block">
      <h2 className="block-title">Case record</h2>
      <dl className="facts">
        <dt>Reference</dt>
        <dd>{result.caseId ?? '\u2014'}</dd>
        <dt>Reported wallet</dt>
        <dd className="cell-mono">{shortAddr(result.walletAddress)}</dd>
        <dt>Hops traced</dt>
        <dd>{result.hopsTraced ?? 0}</dd>
        <dt>Addresses mapped</dt>
        <dd>{result.nodes.length}</dd>
        <dt>Transfers</dt>
        <dd>{result.edges.length}</dd>
        <dt>Traced at</dt>
        <dd>{when(result.completedAt ?? result.requestedAt)}</dd>
        <dt>Status</dt>
        <dd>{result.status}</dd>
      </dl>

      {result.servedFromCache && (
        <p className="attribution-meta" style={{ marginTop: 12 }}>
          Chain lookup was unavailable, so this shows the last completed trace of this address.
        </p>
      )}
      {result.failureReason && <p className="notice">{result.failureReason}</p>}

      <a className="action" style={{ display: 'block', textAlign: 'center', textDecoration: 'none', marginTop: 16 }}
         href={`/api/traces/${result.id}/report`}>
        Download case report
      </a>
    </section>
  );
}
