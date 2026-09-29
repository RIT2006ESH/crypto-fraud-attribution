import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, TriangleAlert } from 'lucide-react';
import {
  DocCta,
  DocHero,
  DocNav,
  DocNote,
  DocSectionBlock,
  DocSteps,
  type DocSection,
} from './DocKit';

const SECTIONS: DocSection[] = [
  { id: 'fit', label: 'When it fits' },
  { id: 'walkthrough', label: 'The walkthrough' },
  { id: 'prepare', label: 'What to bring' },
  { id: 'scope', label: 'Scope and limits' },
];

/**
 * Forensics.
 *
 * The page that explains what an investigator actually gets, and what they should do with
 * it. Deliberately concrete: the value of the tool is the method, and a method described
 * abstractly is not usable.
 */
export default function Forensics() {

  return (
    <>
      <DocHero
        eyebrow="Forensics"
        title="From one wallet address to a defensible account of where the funds went."
        lede="The workstation is built around a single investigative question: what is the chain of counterparties behind this address, which of them are known entities, and which observable signals justify a closer look. This page describes the workflow and the order to work in."
      />

      <DocNav sections={SECTIONS} />

      <DocSectionBlock id="fit" title="When this fits">
        <p>
          Tracing a reported or flagged address is the case the product is built for. So is
          triaging a set of addresses against a sanctions list or a mixer cluster, where the
          question is which of them connect to something already known.
        </p>
        <p>
          It is not a tool for establishing who controls a wallet, for reconstructing activity
          on a chain the indexer does not cover, or for producing a conclusion on its own. The
          graph narrows the search space; a human still has to assess it.
        </p>
      </DocSectionBlock>

      <DocSectionBlock id="walkthrough" title="The walkthrough">
        <DocSteps
          steps={[
            {
              title: 'Start from one address',
              body: 'Enter the reported wallet and let the service resolve the chain, or set it explicitly. An address that is not on a supported chain is rejected immediately rather than traced incorrectly.',
            },
            {
              title: 'Read the shape before the details',
              body: 'The graph shows where value concentrated and where it went. Concentration at one address, or an immediate hop into a mixer, is visible in the layout before a single row is read.',
            },
            {
              title: 'Filter to the population you care about',
              body: 'Isolate sanctioned addresses, mixers, or every unlabelled address. A filtered view is an explicit statement about coverage, and the count of hidden nodes is always shown.',
            },
            {
              title: 'Check the score against its factors',
              body: 'The risk category is a weighted sum. Open the model to see which signals fired and how much each contributed, then decide whether the subgraph justifies the category.',
            },
            {
              title: 'Walk a single transfer to its source',
              body: 'Every edge opens to its amount, asset, transaction hash and timestamp, and to the two counterparties. One transfer traced to a block-explorer entry is a fact; the pattern is the inference.',
            },
            {
              title: 'Export the service-rendered report',
              body: 'The report is generated from the stored trace, so the artefact and the screen describe the same investigation. It is evidence of a bounded search, not of a conclusion.',
            },
          ]}
        />
      </DocSectionBlock>

      <DocSectionBlock id="prepare" title="What to bring">
        <p>
          The only hard requirement is a wallet address on a supported chain. Everything else
          makes the result easier to act on:
        </p>
        <p>
          Your own <strong>case reference</strong> is stored with the trace and carried into
          the report, so a set of investigations stays distinguishable when the results are
          filed together. A case id is metadata on the record, not a report the service writes
          from it.
        </p>
        <DocNote>
          Tracing depth, fan-out and node budget are service configuration. If two traces are
          going to be compared, they need to have been produced under the same settings —
          otherwise they are results from two different search spaces.
        </DocNote>
      </DocSectionBlock>

      <DocSectionBlock id="scope" title="Scope and limits">
        <p>
          A finished trace is a bounded subgraph, not a history. Four limits bound every
          result, and each one changes what a finding can support:
        </p>
        <p>
          Depth stops the walk at four hops. Fan-out keeps ten counterparties per address.
          The node budget caps the walk at sixty addresses. And the walk follows transfer
          direction, so inbound history is not included.
        </p>
        <p>
          Read a partial trace accordingly. If the service reports a partial status, some
          lookups failed or the budget was spent — the subgraph is real, its coverage is not
          complete, and the interface marks it as such rather than presenting it whole.
        </p>
        <p>
          <Link className="link-arrow" to="/how-it-works">
            Read the full method
            <ArrowRight size={13} aria-hidden />
          </Link>
        </p>
      </DocSectionBlock>

      <DemoNote />

      <DocCta />
    </>
  );
}

/**
 * A closing block that names the one thing a reader is most likely to get wrong: reading a
 * risk score as a finding.
 */
function DemoNote() {
  const [open, setOpen] = useState(true);

  return (
    <section className="section section--tight">
      <div className="container">
        <button
          type="button"
          className="doc-callout"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          <span className="doc-callout__icon" aria-hidden>
            {open ? <TriangleAlert size={16} /> : <Check size={16} />}
          </span>
          <span>
            <strong>A score is a triage aid, not a finding.</strong>{' '}
            {open
              ? 'A high category means weighted indicators fired on the subgraph that was traced. It does not establish intent, and it says nothing about activity outside the trace depth. Treat it as a reason to look closer, and record the factors you relied on.'
              : 'A high category means weighted indicators fired on the traced subgraph. It does not establish intent.'}
          </span>
        </button>
      </div>
    </section>
  );
}
