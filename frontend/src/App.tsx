import { useCallback, useState } from 'react';
import TraceForm from './components/TraceForm';
import FlowMap from './components/FlowMap';
import Ledger from './components/Ledger';
import Blank from './components/Blank';
import { Attribution, CaseFacts, RiskStamp } from './components/Verdict';
import { submitTrace } from './api';
import type { TraceInput, TraceResult } from './types';

export default function App() {
  const [result, setResult] = useState<TraceResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focus, setFocus] = useState<string | null>(null);

  async function runTrace(input: TraceInput) {
    setBusy(true);
    setError(null);
    setFocus(null);
    try {
      setResult(await submitTrace(input));
    } catch (e) {
      setResult(null);
      setError(e instanceof Error ? e.message : 'The trace service could not be reached.');
    } finally {
      setBusy(false);
    }
  }

  const clearFocus = useCallback(() => setFocus(null), []);

  return (
    <div className="app">
      <header className="masthead">
        <span className="wordmark">CaseTrace</span>
        <span className="tagline">Crypto fraud attribution for cyber-crime investigators</span>
        <span className="masthead-end">Ethereum mainnet</span>
      </header>

      <div className="workspace">
        <aside className="rail">
          <TraceForm onSubmit={runTrace} busy={busy} />
          {error && (
            <div className="block">
              <p className="notice">{error}</p>
            </div>
          )}
          {result && (
            <>
              <Attribution result={result} />
              <RiskStamp result={result} />
              <CaseFacts result={result} />
            </>
          )}
        </aside>

        <main className="canvas">
          <div className="canvas-head">
            <h2 className="canvas-title">Fund flow</h2>
            <div className="legend">
              <span><i className="swatch" style={{ background: '#fdfefe', borderColor: '#4a2e86', borderWidth: 2 }} />Reported wallet</span>
              <span><i className="swatch" style={{ background: '#10634a' }} />Exchange</span>
              <span><i className="swatch" style={{ background: '#4a2e86' }} />Mixer</span>
              <span><i className="swatch" style={{ background: '#8e1b2e' }} />Sanctioned</span>
              <span><i className="swatch" style={{ background: '#fdfefe' }} />Unlabelled</span>
            </div>
          </div>

          <div className="graph">
            {result && result.nodes.length > 0 ? (
              <FlowMap result={result} onSelect={setFocus} />
            ) : (
              <Blank busy={busy} />
            )}
          </div>

          {result && <Ledger result={result} focus={focus} onClearFocus={clearFocus} />}
        </main>
      </div>
    </div>
  );
}
