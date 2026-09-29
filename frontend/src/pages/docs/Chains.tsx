import { Link } from 'react-router-dom';
import { useChains } from '../../hooks/useChains';
import { CHAIN_PICKER_IDS, chainMeta } from '../../lib/chains';
import {
  DocCta,
  DocHero,
  DocNav,
  DocNote,
  DocSectionBlock,
  SpecTable,
  type DocSection,
} from './DocKit';

const SECTIONS: DocSection[] = [
  { id: 'supported', label: 'Supported chains' },
  { id: 'coverage', label: 'Coverage per chain' },
  { id: 'multi', label: 'Multi-chain requests' },
  { id: 'adding', label: 'Adding a chain' },
];

/**
 * Chains.
 *
 * The chain list is read from the backend at runtime rather than hard-coded in the copy,
 * so this page cannot drift out of date with the service. A chain that the backend does
 * not support is not described here at all.
 */
export default function Chains() {
  const { chains, loading } = useChains();

  /* Only describe chains the backend actually reported. If the call is in flight the
     built-in metadata is still accurate for the two supported chains, so the page is
     readable either way. */
  const live = chains.length > 0 ? chains : null;

  return (
    <>
      <DocHero
        eyebrow="Chains"
        title="Two chains today, described honestly rather than optimistically."
        lede="Ethereum and Tron are traced against their own indexers. A multi-chain request runs both and reports them side by side — it does not stitch them into a single flow, because no observable transfer connects them."
      />

      <DocNav sections={SECTIONS} />

      <DocSectionBlock id="supported" title="Supported chains">
        <SpecTable
          rows={CHAIN_PICKER_IDS.map((id) => {
            const meta = chainMeta(id);
            const reported = live?.find((c) => c.id === id);
            return [
              meta.label,
              <>
                <strong>{meta.dataSource}</strong> — {meta.notes}
                {reported ? (
                  <>
                    {' '}
                    Reported by the service as <code>{reported.name}</code>
                    {reported.nativeSymbol ? `, native asset ${reported.nativeSymbol}` : ''}
                    {reported.tokens.length > 0 ? `, with ${reported.tokens.join(', ')}` : ''}
                    {reported.multi ? '. Multi-chain requests include this chain automatically' : ''}.
                  </>
                ) : loading ? (
                  ' Confirming with the service.'
                ) : (
                  ' Reported by the service.'
                )}
              </>,
            ] as [string, React.ReactNode];
          })}
        />
        <DocNote>
          The chain list is fetched from the service. If a chain is not in that response it is
          not traceable, and this page will not describe it.
        </DocNote>
      </DocSectionBlock>

      <DocSectionBlock id="coverage" title="What is covered on each chain">
        <SpecTable
          rows={[
            [
              'Ethereum Mainnet',
              <>
                Native ETH transfers and ERC-20 token contracts, including the major
                stablecoins. Address format <code>0x</code> plus 40 hex characters.
              </>,
            ],
            [
              'Tron Network',
              <>
                Native TRX transfers and TRC-20 token contracts, including TRC-20 USDT.
                Address format <code>T</code> plus 33 base-58 characters.
              </>,
            ],
            [
              'Both',
              <>
                The same depth, fan-out and node budget apply to each. The bounds are service
                configuration and can differ per deployment. Each chain's result reports the
                hops it reached and any limit that cut it short, but not the bounds
                themselves.
              </>,
            ],
          ]}
        />
      </DocSectionBlock>

      <DocSectionBlock id="multi" title="Multi-chain requests">
        <p>
          Selecting <strong>All chains</strong> fans the request out to every supported chain
          and returns a result per chain alongside a summary. The summary reports the
          worst-case risk across the chains, so a low score on one chain cannot mask a high
          score on another.
        </p>
        <p>
          What it does not do is infer a transfer between an Ethereum address and a Tron
          address. There is no bridge, no bridge analytics and no cross-chain matching in the
          trace — a TRON address cannot appear as a counterparty of an Ethereum address
          because nothing observable connects them.
        </p>
        <DocNote>
          When every chain fails, the request fails. A multi-chain trace is not a partial
          success, and the interface will not render an empty graph as if it were a result.
        </DocNote>
      </DocSectionBlock>

      <DocSectionBlock id="adding" title="Adding a chain">
        <p>
          A new chain is a backend change first and a product change second. The service needs
          an indexer client, address validation for the chain's format, a native currency and
          token-standard mapping, and a registry of the entities worth labelling on it.
        </p>
        <p>
          Only once the service reports the chain from its own chain endpoint does it appear
          in the picker or on this page. The interface reads the list rather than maintaining
          its own copy, so nothing can offer a chain the service cannot trace.
        </p>
        <p>
          <Link className="link-arrow" to="/provenance">
            Read about data provenance
            <span aria-hidden> →</span>
          </Link>
        </p>
      </DocSectionBlock>

      <DocCta />
    </>
  );
}
