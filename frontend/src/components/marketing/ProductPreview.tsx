import { GitBranch, LineChart, ListFilter, MousePointerClick } from 'lucide-react';
import { Link } from 'react-router-dom';
import { DEMO_NODES } from '../../lib/demo';
import SectionEyebrow from '../common/SectionEyebrow';
import { Reveal } from '../common/Reveal';
import { FlowPreview } from './scenes/FlowPreview';

/**
 * 10 — PRODUCT PREVIEW
 *
 * A schematic of the workspace, not a screenshot. Screenshots go stale the moment a
 * class name changes; a drawn schematic stays true to the architecture and costs
 * nothing to maintain. The one call to action is the workspace itself.
 */

const CALLOUTS = [
  {
    Icon: GitBranch,
    name: 'Graph canvas',
    text: 'Left-to-right hop layout, four view modes, and a legend that doubles as a filter.',
  },
  {
    Icon: MousePointerClick,
    name: 'Linked selection',
    text: 'Selecting an address scopes the ledger to its transfers and opens the entity inspector.',
  },
  {
    Icon: LineChart,
    name: 'Risk breakdown',
    text: 'The score, its category, and the arithmetic behind it, always visible beside the graph.',
  },
  {
    Icon: ListFilter,
    name: 'Filter rail',
    text: 'Isolate sanctioned, mixer, exchange or unlabelled addresses to cut a wide graph down.',
  },
] as const;

export default function ProductPreview() {
  return (
    <section className="section" id="workspace" aria-labelledby="preview-title">
      <div className="container">
        <Reveal className="section-head">
          <SectionEyebrow index="10">The workspace</SectionEyebrow>
          <h2 id="preview-title" className="section-title">
            Built for the part where you actually read the evidence.
          </h2>
          <p className="lead">
            One case, one screen. The graph, the ledger, the risk arithmetic and the
            entity inspector stay in sync, because you should never have to re-find what
            you were just looking at.
          </p>
        </Reveal>

        <Reveal delay={0.08} className="preview__frame">
          <div className="preview__bar">
            <span className="preview__dots" aria-hidden>
              <span className="preview__dot" />
              <span className="preview__dot" />
              <span className="preview__dot" />
            </span>
            <span className="preview__url">casetrace / investigate</span>
          </div>
          <div className="preview__body">
            <FlowPreview nodeCount={DEMO_NODES.length} />
          </div>
        </Reveal>

        <div className="preview__callouts">
          {CALLOUTS.map(({ Icon, name, text }) => (
            <div key={name} className="preview__callout">
              <Icon size={18} className="preview__callout-icon" aria-hidden />
              <span className="preview__callout-name">{name}</span>
              <span className="preview__callout-text">{text}</span>
            </div>
          ))}
        </div>

        <Reveal className="workflow__foot">
          <Link to="/investigate" className="btn btn--primary">
            Open the workspace
          </Link>
        </Reveal>
      </div>
    </section>
  );
}
