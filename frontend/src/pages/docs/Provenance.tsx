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
  { id: 'sources', label: 'Sources' },
  { id: 'order', label: 'Resolution order' },
  { id: 'confidence', label: 'Confidence' },
  { id: 'omissions', label: 'What is left out' },
];

/**
 * Provenance.
 *
 * Attribution is the part of a trace most likely to be quoted, so it gets its own page
 * describing where a label came from, in what order, with what confidence, and what the
 * service deliberately refuses to infer. Every entity name in the product is resolvable
 * back to one of the sources below.
 */
export default function Provenance() {

  return (
    <>
      <DocHero
        eyebrow="Provenance"
        title="Where every entity name came from."
        lede="A label on a graph is a claim. This page describes the sources behind it, the order they are consulted in, how confidence is expressed, and — as importantly — which inferences the service declines to make."
      />

      <DocNav sections={SECTIONS} />

      <DocSectionBlock id="sources" title="Sources">
        <DocSteps
          steps={[
            {
              title: 'The chain itself',
              body: 'Transfer data, amounts, token contracts and timestamps come from the chain indexer for the network being traced. This is the only source treated as ground truth for what happened.',
            },
            {
              title: 'The curated entity registry',
              body: 'A maintained list of addresses belonging to known exchanges, mixers, tumblers and published sanctions listings. Highest confidence, because the entries are deliberate.',
            },
            {
              title: 'Provider labels',
              body: 'Labels the chain data provider has already attached to an address. Useful coverage; confidence depends on the provider, so the value is carried through rather than assumed.',
            },
            {
              title: 'On-chain contract metadata',
              body: 'Contract name and token metadata read from the chain itself. A last resort: contract names are self-declared, so a match is a hint rather than a fact.',
            },
          ]}
        />
      </DocSectionBlock>

      <DocSectionBlock id="order" title="Resolution order">
        <p>
          Sources are consulted in a fixed order and the first match wins, so a curated entry
          is never overridden by a noisier source:
        </p>
        <SpecTable
          rows={[
            ['1', 'Cached resolution from an earlier trace in this deployment'],
            ['2', 'Curated entity registry'],
            ['3', 'Provider labels'],
            ['4', 'On-chain contract-name heuristics'],
            ['—', 'No match at any source. The address is reported as unlabelled'],
          ]}
        />
        <p>
          Unlabelled is a real, common outcome and is treated as one. An address with no
          attribution still appears in the graph, still carries its transfers, and is
          displayed without a name rather than with a guess.
        </p>
      </DocSectionBlock>

      <DocSectionBlock id="confidence" title="How confidence is expressed">
        <p>
          Every resolution carries a confidence value between 0 and 1, shown next to the label
          in the interface. Higher-confidence labels are given a higher label; lower ones are
          shown with an explicit band so a reader knows how much weight the name can bear.
        </p>
        <DocNote>
          Confidence describes how the label was resolved. It is not a measure of whether the
          activity is suspicious, and a high-confidence label is not evidence of wrongdoing.
        </DocNote>
      </DocSectionBlock>

      <DocSectionBlock id="omissions" title="What the service will not infer">
        <p>
          A short list, because each of these is something a reasonable person might expect
          and the service deliberately does not do:
        </p>
        <SpecTable
          rows={[
            ['Cross-chain transfers', 'No bridge analytics, no cross-chain matching. A TRON address is never presented as a counterparty of an Ethereum address'],
            ['Wallet ownership', 'An address is attributed to an entity, never to a person. KYC relationships are not resolved or inferred'],
            ['Intent', 'A mixer downstream is a routing signal. The service does not state what the participants intended'],
            ['Off-chain activity', 'Exchanges, custodians and bridges that do not publish on-chain are out of scope by construction'],
            ['Missing history', 'An address absent from a trace was outside the depth or fan-out limit. Absence is not evidence of absence'],
          ]}
        />
        <p>
          These are limits of the method, not gaps awaiting a feature. Each one would require
          data the service does not have, and presenting an inference built on data it lacks
          would misrepresent the result.
        </p>
      </DocSectionBlock>

      <DocCta />
    </>
  );
}
