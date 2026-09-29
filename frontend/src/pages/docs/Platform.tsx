import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import {
  DocCta,
  DocHero,
  DocNav,
  DocNote,
  DocSectionBlock,
  DocSteps,
  SpecTable,
  type DocSection,
} from './DocKit';

const SECTIONS: DocSection[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'pipeline', label: 'Pipeline' },
  { id: 'limits', label: 'Limits' },
  { id: 'output', label: 'Output' },
];

/**
 * The platform.
 *
 * Written as a description of the service rather than of the interface, because a
 * reader who is evaluating this for an investigation workflow needs to know what
 * happens to a submitted address before they need to know what the buttons are called.
 */
export default function Platform() {

  return (
    <>
      <DocHero
        eyebrow="Platform"
        title="One address in, an explained chain of counterparties out."
        lede="CaseTrace is a fund-flow tracing and entity-attribution service for public blockchains. You submit a wallet address; it returns the transfers that address took part in, the entities behind the other side of those transfers, and a scored set of risk signals — each of which is traceable to the transfer that produced it."
        actions={
          <>
            <Link className="btn btn--primary btn--lg" to="/investigate">
              Trace an address
              <ArrowRight size={16} aria-hidden />
            </Link>
            <Link className="btn btn--ghost btn--lg" to="/capabilities">
              What it can and cannot do
            </Link>
          </>
        }
      />

      <DocNav sections={SECTIONS} />

      <DocSectionBlock id="overview" title="What a trace actually is">
        <p>
          A trace is a breadth-first walk outward from one address. At each hop the service
          collects the transfers involving that address, adds the addresses on the other side
          of them, and repeats — stopping at a configured depth or when the node budget is
          reached.
        </p>
        <p>
          That walk is a bounded sample, not the address's complete history. Everything the
          service reports is scoped to what it looked at, and the interface is explicit about
          that boundary rather than presenting a subgraph as a ledger.
        </p>
      </DocSectionBlock>

      <DocSectionBlock id="pipeline" title="The four stages">
        <DocSteps
          steps={[
            {
              title: 'Validate',
              body: 'The address is checked for format and matched to a supported chain. An address that does not resolve is rejected with the reason, rather than being traced against the wrong chain.',
            },
            {
              title: 'Trace',
              body: 'Transfers are collected hop by hop from the chain indexer, with a per-address fan-out limit and a total node budget so one very busy address cannot monopolise the request.',
            },
            {
              title: 'Attribute',
              body: 'Each address is resolved against the curated entity registry, then provider labels, then on-chain contract-name heuristics. Each resolution carries a confidence, and an address that resolves to nothing stays unlabelled.',
            },
            {
              title: 'Assess',
              body: 'Observable signals in the traced subgraph are weighted and summed, capped at 100, and mapped to a category. The raw factors are returned alongside the score.',
            },
          ]}
        />
      </DocSectionBlock>

      <DocSectionBlock id="limits" title="Configured limits">
        <p>
          These are service configuration, not browser settings. The interface shows them
          because an investigator reasoning about a result needs to know the search space it
          came from.
        </p>
        <SpecTable
          rows={[
            ['Trace depth', '4 hops by default'],
            ['Fan-out', '10 counterparties per address, so a routing hub does not swamp the graph'],
            ['Node budget', '60 addresses per trace'],
            ['Chains', 'Ethereum Mainnet and Tron. Multi-chain requests run per chain and are reported side by side'],
            [
              'Multi-chain semantics',
              <>
                A trace across both chains is <strong>not</strong> a cross-chain trace. The
                service never infers a transfer between a TRON address and an Ethereum address;
                the two results are separate subgraphs with a shared summary.
              </>,
            ],
          ]}
        />
        <DocNote>
          If a trace returns a partial status, some lookups failed or the budget was
          exhausted. A partial result is surfaced as a distinct state in the workstation
          rather than presented as a complete graph.
        </DocNote>
      </DocSectionBlock>

      <DocSectionBlock id="output" title="What comes back">
        <p>
          Every response is a record, not a verdict: the wallet traced, the nodes and edges in
          range, the resolved labels with their confidence, the weighted risk factors, and a
          report rendered by the service itself.
        </p>
        <p>
          The service exposes the same data over REST and GraphQL. REST responses store
          findings as a single delimited string; the GraphQL schema splits that into a real
          list, so API consumers do not have to parse it themselves.
        </p>
      </DocSectionBlock>

      <DocCta />
    </>
  );
}
