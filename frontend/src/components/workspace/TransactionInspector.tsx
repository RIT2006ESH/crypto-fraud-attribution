import { useState } from 'react';
import { motion } from 'framer-motion';
import { Copy, Crosshair, ExternalLink, X } from 'lucide-react';
import { chainMeta, explorerTxUrl } from '../../lib/chains';
import { formatAmount, shortenAddress } from '../../format';
import { displaySymbol, symbolAdvisory, symbolAdvisoryText } from '../../lib/symbols';
import { prefersReducedMotion } from '../../lib/graph/fit';
import { entityMeta } from '../../lib/entities';
import type { GraphEdgeView, GraphView } from '../../lib/graph';
import type { EdgeDto } from '../../types';
import { Field, Note, Section } from './InspectorParts';

interface Props {
  view: GraphView;
  chain: string;
  edge: GraphEdgeView;
  onClose: () => void;
  onFocus: (id: string, kind: 'node' | 'edge') => void;
  onOpenTransfer: (transfer: EdgeDto) => void;
}

/**
 * The transaction inspector.
 *
 * Opens on an aggregated connection, so it leads with the summary — how many
 * transfers, what total, which asset — and lists the individual transactions beneath
 * it. Collapsing two hundred transfers into one line and then losing them would trade
 * clarity for evidence; this keeps both.
 */
export default function TransactionInspector({
  view,
  chain,
  edge,
  onClose,
  onFocus,
  onOpenTransfer,
}: Props) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const reduced = prefersReducedMotion();

  const advisory = symbolAdvisory(edge.asset === 'native' ? null : edge.assetLabel);
  const source = view.byAddress.get(edge.source);
  const target = view.byAddress.get(edge.target);
  const showAll = edge.transfers.length <= 6;
  const visible = showAll || expanded ? edge.transfers : edge.transfers.slice(0, 4);

  const copyHash = async (hash: string) => {
    try {
      await navigator.clipboard.writeText(hash);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* Refused clipboard access is not worth interrupting a case over. */
    }
  };

  return (
    <>
      <button
        type="button"
        className="inspector-scrim"
        onClick={onClose}
        aria-label="Close the transaction inspector"
      />
      <motion.aside
        className="inspector inspector--transaction"
        aria-label={`Details for the connection from ${shortenAddress(edge.source)} to ${shortenAddress(edge.target)}`}
        initial={reduced ? false : { x: 28, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: reduced ? 0 : 0.26, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="inspector__head">
          <div className="inspector__heading">
            <span className="inspector__kicker">
              {edge.transferCount === 1 ? 'Transaction' : 'Aggregated connection'}
            </span>
            <h3 className="inspector__title">
              {edge.transferCount} transfer{edge.transferCount === 1 ? '' : 's'}
            </h3>
          </div>
          <button type="button" className="inspector__close" onClick={onClose} aria-label="Close the transaction inspector">
            <X size={15} aria-hidden />
          </button>
        </div>

        <div className="inspector__body">
          <Section title="Summary">
            <Field k="Total value" v={formatAmount(edge.totalAmount, edge.assetLabel === 'native' ? null : edge.assetLabel)} />
            <Field k="Asset" v={edge.assetLabel} />
            <Field k="Transfers" v={String(edge.transferCount)} />
            <Field
              k="Direction"
              v={`${shortenAddress(edge.source)} → ${shortenAddress(edge.target)}`}
            />
            {edge.firstSeen ? <Field k="First seen" v={formatTimestamp(edge.firstSeen)} /> : null}
            {advisory ? (
              <p className="inspector__warn">
                {symbolAdvisoryText(advisory)}
              </p>
            ) : null}
          </Section>

          <Section title="Counterparties">
            <Counterparty
              role="From"
              address={edge.source}
              label={source?.entityName ?? null}
              labelType={source?.labelType ?? null}
              isRoot={source?.isRoot ?? false}
              transfers={source?.outgoing ?? 0}
              onFocus={onFocus}
            />
            <Counterparty
              role="To"
              address={edge.target}
              label={target?.entityName ?? null}
              labelType={target?.labelType ?? null}
              isRoot={target?.isRoot ?? false}
              transfers={target?.incoming ?? 0}
              onFocus={onFocus}
            />
          </Section>

          <Section title={`Transfers (${edge.transferCount})`}>
            {edge.transferCount === 1 ? (
              <p className="inspector__note">
                One transfer carries this connection, so no aggregation was applied.
              </p>
            ) : (
              <p className="inspector__note">
                These {edge.transferCount} transfers share both counterparties and this asset, so the
                graph draws them as one connection. The ledger still holds every one.
              </p>
            )}

            <ul className="transfer-list">
              {visible.map((t) => (
                <li key={t.txHash.toLowerCase()}>
                  <button
                    type="button"
                    className="transfer-row"
                    onClick={() => onOpenTransfer(t)}
                    title="Open this transfer in the ledger"
                  >
                    <span className="transfer-row__amount is-mono">
                      {formatAmount(t.amount, displaySymbol(t.tokenSymbol))}
                    </span>
                    <span className="transfer-row__hash is-mono">{shortenHash(t.txHash)}</span>
                    <span className="transfer-row__time">{formatTimestamp(t.txTimestamp)}</span>
                  </button>
                </li>
              ))}
            </ul>

            {!showAll ? (
              <button
                type="button"
                className="ghost-btn ghost-btn--block"
                onClick={() => setExpanded((v) => !v)}
                aria-expanded={expanded}
              >
                {expanded
                  ? 'Show fewer'
                  : `Show all ${edge.transferCount} transfers`}
              </button>
            ) : null}
          </Section>

          {edge.transfers.length === 1 ? (
            <Section title="Transaction">
              <Field k="Tx hash" v={shortenHash(edge.transfers[0].txHash)} />
              <div className="inspector__actions">
                <button
                  type="button"
                  className="ghost-btn"
                  onClick={() => copyHash(edge.transfers[0].txHash)}
                >
                  {copied ? 'Copied' : 'Copy hash'}
                  <Copy size={12} aria-hidden />
                </button>
                {explorerTxUrl(chain, edge.transfers[0].txHash) ? (
                  <a
                    className="ghost-btn"
                    href={explorerTxUrl(chain, edge.transfers[0].txHash) as string}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    {chainMeta(chain).short}
                    <ExternalLink size={12} aria-hidden />
                  </a>
                ) : null}
              </div>
            </Section>
          ) : null}

          <Section title="Source">
            <Note>
              Amounts and hashes are the values the service recorded for these transfers. A token symbol
              is chosen by the token’s deployer and is not assigned by the chain.
            </Note>
          </Section>
        </div>

        <footer className="inspector__foot">
          <button
            type="button"
            className="btn btn--secondary btn--sm"
            onClick={() => onFocus(edge.source, 'node')}
          >
            <Crosshair size={12} aria-hidden />
            Focus source
          </button>
          <button
            type="button"
            className="btn btn--secondary btn--sm"
            onClick={() => onFocus(edge.target, 'node')}
          >
            <Crosshair size={12} aria-hidden />
            Focus destination
          </button>
        </footer>
      </motion.aside>
    </>
  );
}

function Counterparty({
  role,
  address,
  label,
  labelType,
  isRoot,
  transfers,
  onFocus,
}: {
  role: string;
  address: string;
  label: string | null;
  labelType: string | null;
  isRoot: boolean;
  transfers: number;
  onFocus: (id: string, kind: 'node' | 'edge') => void;
}) {
  const meta = entityMeta(labelType as never);
  return (
    <div className="counterparty">
      <span className="counterparty__role">{role}</span>
      <button type="button" className="counterparty__btn" onClick={() => onFocus(address, 'node')}>
        <span className="counterparty__name" style={{ color: meta.color }}>
          {label ?? (isRoot ? 'Reported wallet' : meta.short)}
        </span>
        <code className="inspector__mono">{shortenAddress(address)}</code>
        <span className="counterparty__meta">
          {transfers} transfer{transfers === 1 ? '' : 's'} in this trace
        </span>
      </button>
    </div>
  );
}

function shortenHash(hash: string): string {
  if (hash.length <= 16) return hash;
  return `${hash.slice(0, 10)}…${hash.slice(-6)}`;
}

function formatTimestamp(value: string | null): string {
  if (!value) return 'Not reported';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toISOString().replace('T', ' ').slice(0, 19) + 'Z';
}
