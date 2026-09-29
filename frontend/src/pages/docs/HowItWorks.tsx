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
  { id: 'submit', label: 'Submitting' },
  { id: 'tracing', label: 'How tracing works' },
  { id: 'states', label: 'Run states' },
  { id: 'limits', label: 'Boundaries' },
];

/**
 * How it works.
 *
 * Written for the engineer who will integrate or audit the trace: the request, the walk,
 * the states the interface can be in, and the boundaries of the result. The run-state
 * table exists because "what does the API do while it is working" is the question that
 * decides how an integration is written.
 */
export default function HowItWorks() {

  return (
    <>
      <DocHero
        eyebrow="How it works"
        title="A breadth-first walk, bounded on three axes."
        lede="Understanding exactly how a trace is produced matters more than any feature list, because it determines what a result can and cannot be used to argue. Here is the request, the walk, the states and the boundaries."
      />

      <DocNav sections={SECTIONS} />

      <DocSectionBlock id="submit" title="Submitting a trace">
        <p>
          One call. The wallet address is required; the chain is optional and defaults to
          automatic detection from the address format.
        </p>
        <SpecTable
          rows={[
            ['Endpoint', 'POST /api/traces'],
            ['Required', 'walletAddress — a full Ethereum (0x…) or Tron (T…) address'],
            ['Optional', 'chain — ethereum, tron, or all. Omit to detect from the address'],
            ['Optional', 'caseId — your own reference, stored with the trace and echoed back'],
            ['Validation', 'Format is checked against the selected chain. A mismatch is rejected with the reason, not traced anyway'],
          ]}
        />
        <p>
          A rejected address returns a 400 with a message that says which format was expected.
          There is no silent fallback to a different chain.
        </p>
      </DocSectionBlock>

      <DocSectionBlock id="tracing" title="How the walk proceeds">
        <DocSteps
          steps={[
            {
              title: 'Seed',
              body: 'The submitted address becomes the root node at hop 0 and the queue starts there.',
            },
            {
              title: 'Collect',
              body: 'For the address at the head of the queue, the indexer is asked for the transfers involving it. Each counterparty on the other side becomes a node at the next hop.',
            },
            {
              title: 'Cap',
              body: 'At each address the counterparties kept are limited by the fan-out setting, choosing the earliest transfers. The whole walk is limited by the node budget.',
            },
            {
              title: 'Attribute',
              body: 'Every node is resolved to an entity, or left unlabelled. Labels are resolved once per trace and cached for later requests.',
            },
            {
              title: 'Score and return',
              body: 'Risk signals are evaluated over the resulting subgraph, weighted, capped and categorised, and the whole record is returned with the raw factors.',
            },
          ]}
        />
        <p>
          Because the walk follows transfer direction, funds moving toward the reported wallet
          are not traced backward from it. If you need inbound history, submit the upstream
          address.
        </p>
      </DocSectionBlock>

      <DocSectionBlock id="states" title="Run states">
        <p>
          A trace is a single request with no progress channel. The service therefore returns
          one terminal result, and the interface distinguishes the outcomes rather than
          animating a percentage it does not know.
        </p>
        <SpecTable
          rows={[
            ['Completed', 'A full result for every address the walk reached'],
            ['Partial', 'Some lookups failed or the budget was exhausted. The subgraph is usable but the coverage is not complete, and the interface says so'],
            ['Failed', 'No result. The reason is returned with the error rather than swallowed'],
            ['In flight', 'Still running. Stage labels are shown as elapsed-time indications of the request\'s phase; they are not progress reported by the service'],
          ]}
        />
        <DocNote>
          Stage labels during a run are inferred from elapsed time, because the trace endpoint
          is one request with no intermediate events. No percentage or ETA is displayed,
          because inventing one would be a fabricated number.
        </DocNote>
      </DocSectionBlock>

      <DocSectionBlock id="limits" title="Boundaries of the result">
        <p>
          Three settings bound every trace, and they bound what the result can support as
          evidence:
        </p>
        <SpecTable
          rows={[
            ['Depth — 4 hops', 'A counterparty four hops out is not included. Absence from the graph is not absence of activity'],
            ['Fan-out — 10 per address', 'A routing hub contributes its first ten counterparties, not all of them'],
            ['Budget — 60 nodes', 'A trace stops when the budget is spent. The status reflects it'],
            ['Direction — outward only', 'Only transfers flowing away from the reported wallet are walked'],
          ]}
        />
        <p>
          The values above are the shipped defaults and can be changed per deployment, so
          do not read them out of a result. What a trace reports is what it actually
          reached: the hops it walked, and a limitation whenever a bound cut the walk
          short. An investigator comparing two results is comparing two different search
          spaces if the settings differ, and the response does not tell you which settings
          were in force.
        </p>
      </DocSectionBlock>

      <DocCta />
    </>
  );
}
