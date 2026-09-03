import { useState } from 'react';
import type { TraceInput } from '../types';

const SAMPLE = '0xde0B295669a9FD93d5F28D9Ec85E40f4cb697BAE';

interface Props {
  onSubmit: (input: TraceInput) => void;
  busy: boolean;
}

export default function TraceForm({ onSubmit, busy }: Props) {
  const [address, setAddress] = useState('');
  const [caseId, setCaseId] = useState('');
  const [chain, setChain] = useState('ethereum');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = address.trim();
    if (!trimmed) return;
    onSubmit({ walletAddress: trimmed, chain, caseId: caseId.trim() || undefined });
  }

  return (
    <form className="block" onSubmit={handleSubmit}>
      <h2 className="block-title">Trace a reported wallet</h2>

      <label className="field">
        <span className="field-label">Wallet address from the complaint</span>
        <input
          className="input input-mono"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="0x…"
          spellCheck={false}
          autoComplete="off"
        />
      </label>

      <div className="row">
        <label className="field">
          <span className="field-label">Case or NCRP reference</span>
          <input
            className="input"
            value={caseId}
            onChange={(e) => setCaseId(e.target.value)}
            placeholder="optional"
          />
        </label>
        <label className="field">
          <span className="field-label">Chain</span>
          <select className="select" value={chain} onChange={(e) => setChain(e.target.value)}>
            <option value="ethereum">Ethereum</option>
          </select>
        </label>
      </div>

      <button className="action" type="submit" disabled={busy || !address.trim()}>
        {busy ? 'Following the money…' : 'Trace funds'}
      </button>

      {!busy && (
        <p className="attribution-meta">
          No address handy?{' '}
          <button type="button" className="link-button" onClick={() => setAddress(SAMPLE)}>
            Load a high-activity test address
          </button>
        </p>
      )}
    </form>
  );
}
