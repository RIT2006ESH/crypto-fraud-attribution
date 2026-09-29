import { useMemo } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ExternalLink, CornerUpRight, CornerDownRight, TriangleAlert, X } from 'lucide-react';
import { entityMeta } from '../../lib/entities';
import type { GraphEdgeView, GraphNodeView, GraphView, Selection } from '../../lib/graph';
import { formatAmount, formatDate, shortenAddress, shortenHash } from '../../format';
import CopyButton from '../common/CopyButton';
import { DURATION, EASE } from '../../lib/motion';
import { chainMeta } from '../../lib/chains';
import { displaySymbol, symbolAdvisory, symbolAdvisoryText } from '../../lib/symbols';

/**
 * The inspector drawer.
 *
 * One surface, two payloads: an address and a transfer. Both read in the same order —
 * identity, then what the service observed, then what it inferred — so an investigator
 * learns where to look once.
 *
 * The distinction the layout enforces: observations (addresses, amounts, transaction
 * hashes) sit in key/value rows, while inferences (entity label, risk) are stated in
 * prose with their confidence. They are never given equal visual weight, because only
 * one of them is a fact about the chain.
 */

interface Props {
  selection: Selection | null;
  view: GraphView | null;
  chain: string;
  onClose: () => void;
  onFocus: (id: string, kind: 'node' | 'edge') => void;
}

export default function EntityInspector({ selection, view, chain, onClose, onFocus }: Props) {
  const reduce = useReducedMotion();

  const node = useMemo(() => {
    if (!view || selection?.kind !== 'node') return null;
    return view.byAddress.get(selection.address) ?? null;
  }, [view, selection]);

  const edge = useMemo(() => {
    if (!view || selection?.kind !== 'edge') return null;
    return view.edges.find((e) => e.id === selection.id) ?? null;
  }, [view, selection]);

  /* The drawer only exists once something is selected. A permanent "nothing selected"
     panel would cover a third of the workspace behind a scrim and block the toolbar,
     which is the wrong cost for a prompt the graph hint already gives. */
  if (!view || !selection || (!node && !edge)) return null;

  return (
    <>
      {/* Clicking the map dismisses the drawer; the close button is the keyboard route. */}
      <button type="button" className="inspector-scrim" onClick={onClose} aria-label="Close the inspector" />

      <AnimatePresence mode="wait" initial={false}>
        <motion.aside
          key={node?.id ?? edge?.id ?? 'empty'}
          className="inspector"
          aria-label="Selection details"
          initial={reduce ? false : { x: 28, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={reduce ? { opacity: 0 } : { x: 28, opacity: 0 }}
          transition={{ duration: DURATION.small, ease: EASE.out }}
        >
          {node ? (
            <NodeInspector node={node} view={view} chain={chain} onFocus={onFocus} onClose={onClose} />
          ) : edge ? (
            <EdgeInspector edge={edge} view={view} chain={chain} onFocus={onFocus} onClose={onClose} />
          ) : null}
        </motion.aside>
      </AnimatePresence>
    </>
  );
}

function InspectorShell({
  glyph,
  color,
  title,
  kicker,
  onClose,
  children,
}: {
  glyph: React.ReactNode;
  color?: string;
  title: string;
  kicker: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <>
      <div className="inspector__head">
        <div className="inspector__heading">
          <span className="inspector__kicker" style={{ color }}>
            {glyph} {kicker}
          </span>
          <h3 className="inspector__title" style={{ color }}>
            {title}
          </h3>
        </div>
        <button type="button" className="inspector__close" onClick={onClose} aria-label="Close the inspector">
          <X size={15} aria-hidden />
        </button>
      </div>
      <div className="inspector__body">{children}</div>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="inspector__section">
      <h4 className="inspector__section-title">{title}</h4>
      {children}
    </section>
  );
}

function NodeInspector({
  node,
  view,
  chain,
  onFocus,
  onClose,
}: {
  node: GraphNodeView;
  view: GraphView;
  chain: string;
  onFocus: Props['onFocus'];
  onClose: () => void;
}) {
  const meta = entityMeta(node.labelType);
  const incoming = view.edges.filter((e) => e.target === node.id);
  const outgoing = view.edges.filter((e) => e.source === node.id);
  const addressUrl = explorerUrl(chain, node.id);

  return (
    <InspectorShell
      glyph={meta.glyph}
      color={meta.color}
      title={node.entity ?? meta.label}
      kicker={node.isRoot ? 'Reported wallet' : `Hop ${node.hopDepth}`}
      onClose={onClose}
    >
        <Section title="Address">
          <div className="kv">
            <div className="kv__row">
              <span className="kv__key">Address</span>
              <span className="kv__val">
                <span className="inspector__mono">{node.node.address}</span>
                <CopyButton value={node.node.address} label="Copy address" />
                {addressUrl ? (
                  <a className="inspector__link" href={addressUrl} target="_blank" rel="noreferrer noopener">
                    <ExternalLink size={12} aria-hidden />
                    <span className="sr-only">Open this address in a block explorer</span>
                  </a>
                ) : null}
              </span>
            </div>
            {node.labelType ? (
              <div className="kv__row">
                <span className="kv__key">Attribution</span>
                <span className="kv__val">{meta.label}</span>
              </div>
            ) : (
              <div className="kv__row">
                <span className="kv__key">Attribution</span>
                <span className="kv__val">None resolved</span>
              </div>
            )}
            {node.node.labelConfidence !== null && node.node.labelConfidence !== undefined ? (
              <div className="kv__row">
                <span className="kv__key">Confidence</span>
                <span className="kv__val">
                  {node.node.labelConfidence.toFixed(2)}
                  <span className="tagline">{confidenceBand(node.node.labelConfidence)}</span>
                </span>
              </div>
            ) : null}
          </div>
        </Section>

        <Section title="Observed in this trace">
          <div className="facts-grid">
            <div className="fact-box">
              <span className="fact-value">{node.incoming}</span>
              <span className="fact-label">Received</span>
            </div>
            <div className="fact-box">
              <span className="fact-value">{node.outgoing}</span>
              <span className="fact-label">Sent</span>
            </div>
          </div>
          <p className="disclosure__note" style={{ marginTop: 2 }}>
            Counts and volume cover this trace only. An address may have activity the depth
            limit did not reach.
          </p>
        </Section>

        <TransferList
          title="Received from"
          glyph={<CornerDownRight size={12} aria-hidden />}
          edges={incoming}
          self={node.id}
          view={view}
          onFocus={onFocus}
        />
        <TransferList
          title="Sent to"
          glyph={<CornerUpRight size={12} aria-hidden />}
          edges={outgoing}
          self={node.id}
          view={view}
          onFocus={onFocus}
        />
    </InspectorShell>
  );
}

function EdgeInspector({
  edge,
  view,
  chain,
  onFocus,
  onClose,
}: {
  edge: GraphEdgeView;
  view: GraphView;
  chain: string;
  onFocus: Props['onFocus'];
  onClose: () => void;
}) {
  const from = view.byAddress.get(edge.source);
  const to = view.byAddress.get(edge.target);
  const txUrl = explorerTxUrl(chain, edge.edge.txHash);
  const advisory = symbolAdvisory(edge.edge.tokenSymbol);

  return (
    <InspectorShell
      glyph={<CornerUpRight size={13} aria-hidden />}
      color="var(--accent-primary)"
      title="Transfer"
      kicker={edge.isStable ? 'Stablecoin movement' : 'Token movement'}
      onClose={onClose}
    >
        <Section title="Observed">
          <div className="kv">
            <div className="kv__row">
              <span className="kv__key">Amount</span>
              <span className="kv__val">{formatAmount(edge.edge.amount, edge.edge.tokenSymbol)}</span>
            </div>
            <div className="kv__row">
              <span className="kv__key">Token</span>
              <span className="kv__val">
                {displaySymbol(edge.edge.tokenSymbol)}
                {advisory ? (
                  <span className="inspector__warn" title={symbolAdvisoryText(advisory)}>
                    <TriangleAlert size={12} aria-hidden />
                    {symbolAdvisoryText(advisory)}
                  </span>
                ) : null}
              </span>
            </div>
            <div className="kv__row">
              <span className="kv__key">Transfer type</span>
              <span className="kv__val">{edge.edge.transferType || 'native'}</span>
            </div>
            <div className="kv__row">
              <span className="kv__key">Observed</span>
              <span className="kv__val">{formatDate(edge.edge.txTimestamp)}</span>
            </div>
          </div>
        </Section>

        <Section title="Transaction">
          <div className="inspector__row">
            <code className="inspector__mono">{edge.edge.txHash}</code>
            <CopyButton value={edge.edge.txHash} label="Copy transaction hash" />
            {txUrl ? (
              <a className="inspector__link" href={txUrl} target="_blank" rel="noreferrer noopener">
                <ExternalLink size={12} aria-hidden />
                <span className="sr-only">Open this transaction in a block explorer</span>
              </a>
            ) : null}
          </div>
        </Section>

        <Section title="Counterparties">
          <Counterparty role="From" node={from ?? null} chain={chain} onFocus={onFocus} />
          <Counterparty role="To" node={to ?? null} chain={chain} onFocus={onFocus} />
        </Section>

        {edge.isOnPathRisk ? (
          <p className="disclosure__note" style={{ marginTop: 14, marginBottom: 0 }}>
            This transfer sends value into a mixer or sanctioned address. That is a routing
            signal, not proof of intent.
          </p>
        ) : null}
    </InspectorShell>
  );
}

function Counterparty({
  role,
  node,
  chain,
  onFocus,
}: {
  role: string;
  node: GraphNodeView | null;
  chain: string;
  onFocus: Props['onFocus'];
}) {
  if (!node) {
    return (
      <div className="inspector__section" style={{ paddingTop: 10 }}>
        <h4 className="inspector__section-title">{role}</h4>
        <p className="disclosure__note">Outside the traced subgraph.</p>
      </div>
    );
  }

  const meta = entityMeta(node.labelType);
  const url = explorerUrl(chain, node.id);

  return (
    <div className="inspector__section" style={{ paddingTop: 10 }}>
      <h4 className="inspector__section-title">{role}</h4>
      <button
        type="button"
        className="counterparty"
        onClick={() => onFocus(node.id, 'node')}
        title={`Inspect ${node.entity ?? shortenAddress(node.id)}`}
      >
        <span className="counterparty__glyph" style={{ color: meta.color }}>
          {meta.glyph}
        </span>
        <span className="counterparty__body">
          <span className="counterparty__name" style={{ color: node.entity ? meta.color : undefined }}>
            {node.entity ?? shortenAddress(node.id)}
          </span>
          <span className="tagline">
            {meta.label} · hop {node.hopDepth}
          </span>
        </span>
      </button>
      {url ? (
        <a className="inspector__sublink" href={url} target="_blank" rel="noreferrer noopener">
          <ExternalLink size={11} aria-hidden />
          View on explorer
        </a>
      ) : null}
    </div>
  );
}

function TransferList({
  title,
  glyph,
  edges,
  self,
  view,
  onFocus,
}: {
  title: string;
  glyph: React.ReactNode;
  edges: GraphEdgeView[];
  self: string;
  view: GraphView;
  onFocus: Props['onFocus'];
}) {
  if (edges.length === 0) return null;

  return (
    <Section title={`${title} · ${edges.length}`}>
      <ul className="transfer-list">
        {edges.slice(0, 6).map((edge) => {
          const otherId = edge.source === self ? edge.target : edge.source;
          const other = view.byAddress.get(otherId);
          const otherMeta = entityMeta(other?.labelType);
          return (
            <li key={edge.id}>
              <button type="button" className="transfer-row" onClick={() => onFocus(edge.id, 'edge')}>
                <span className="transfer-row__glyph" style={{ color: otherMeta.color }}>
                  {glyph}
                </span>
                <span className="transfer-row__body">
                  <span className="transfer-row__name">
                    {other?.entity ?? shortenAddress(otherId)}
                  </span>
                  <span className="tagline">{shortenHash(edge.edge.txHash)}</span>
                </span>
                <span className="transfer-row__amount">
                  {formatAmount(edge.edge.amount, edge.edge.tokenSymbol)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {edges.length > 6 ? (
        <p className="disclosure__note">{edges.length - 6} more in the ledger below.</p>
      ) : null}
    </Section>
  );
}

function confidenceBand(value: number): string {
  if (value >= 0.9) return 'high';
  if (value >= 0.6) return 'moderate';
  return 'low';
}

/**
 * Explorer links are built only for chains with a verified template, and only for
 * EVM-shaped values, so a link is never rendered against a format it was not built for.
 * An address that fails the shape check simply gets no link.
 */
function explorerUrl(chain: string, address: string): string | null {
  const template = chainMeta(chain).explorerAddressTemplate;
  if (!template || !/^0x[a-fA-F0-9]{40}$/.test(address)) return null;
  return template.replace('{address}', address);
}

function explorerTxUrl(chain: string, hash: string): string | null {
  const template = chainMeta(chain).explorerTxTemplate;
  if (!template || !/^0x[a-fA-F0-9]{64}$/.test(hash)) return null;
  return template.replace('{hash}', hash);
}
