import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import SectionEyebrow from '../../components/common/SectionEyebrow';

/**
 * Documentation page primitives.
 *
 * The secondary pages are not marketing pages: no illustrations, no synthetic
 * statistics, no claims the service does not make. They are reference material with
 * the same typography as the marketing site so the two do not read as different
 * products, and the same disclosure discipline so a reader never has to wonder which
 * number on the site came from a real trace.
 */

export interface DocSection {
  id: string;
  label: string;
}

export function DocHero({
  eyebrow,
  title,
  lede,
  actions,
}: {
  eyebrow: string;
  title: string;
  lede: string;
  actions?: ReactNode;
}) {
  return (
    <header className="doc-hero">
      <div className="container">
        <div className="doc-hero__inner">
          <SectionEyebrow>{eyebrow}</SectionEyebrow>
          <h1 className="doc-hero__title">{title}</h1>
          <div className="prose">
            <p>{lede}</p>
          </div>
          {actions ? <div className="doc-actions">{actions}</div> : null}
        </div>
      </div>
    </header>
  );
}

/**
 * Sticky sub-navigation. Scrolls horizontally on narrow screens rather than wrapping.
 *
 * The active item is read from the URL hash on mount rather than passed in, so a page
 * cannot point its own nav at the wrong section and each page has one less thing to
 * get right.
 */
export function DocNav({ sections }: { sections: DocSection[] }) {
  const [current, setCurrent] = useState(() => hashSection(sections));

  useEffect(() => {
    const onHashChange = () => setCurrent(hashSection(sections));
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [sections]);

  return (
    <nav className="doc-nav" aria-label="On this page">
      <div className="doc-nav__inner">
        {sections.map((section) => (
          <a
            key={section.id}
            href={`#${section.id}`}
            className={`doc-nav__link${section.id === current ? ' doc-nav__link--active' : ''}`}
          >
            {section.label}
          </a>
        ))}
      </div>
    </nav>
  );
}

export function DocSectionBlock({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="section section--flush-top" id={id}>
      <div className="container">
        <div className="prose">
          <h2>{title}</h2>
          {children}
        </div>
      </div>
    </section>
  );
}

export function SpecTable({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <table className="spec-table">
      <tbody>
        {rows.map(([key, value]) => (
          <tr key={key}>
            <th scope="row">{key}</th>
            <td>{value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * A disclosure note. Used wherever a page states a limit of the service, so the
 * caveat is visually tied to the claim it qualifies rather than buried in a footer.
 */
export function DocNote({ children }: { children: ReactNode }) {
  return (
    <p className="disclosure-note">
      <strong>Disclosure.</strong> {children}
    </p>
  );
}

export function DocSteps({ steps }: { steps: { title: string; body: string }[] }) {
  return (
    <ol className="doc-steps">
      {steps.map((step, i) => (
        <li className="doc-step" key={step.title}>
          <span className="doc-step__index" aria-hidden>
            {String(i + 1).padStart(2, '0')}
          </span>
          <div>
            <h3 className="doc-step__title">{step.title}</h3>
            <p className="doc-step__body">{step.body}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function DocCards({ cards }: { cards: { title: string; body: string; to?: string }[] }) {
  return (
    <div className="doc-cards">
      {cards.map((card) => {
        const inner = (
          <>
            <h3 className="doc-card__title">{card.title}</h3>
            <p className="doc-card__body">{card.body}</p>
            {card.to ? (
              <span className="link-arrow">
                Read more <ArrowRight size={13} aria-hidden />
              </span>
            ) : null}
          </>
        );
        return card.to ? (
          <Link className="doc-card" to={card.to} key={card.title}>
            {inner}
          </Link>
        ) : (
          <div className="doc-card" key={card.title}>
            {inner}
          </div>
        );
      })}
    </div>
  );
}

/** Standard closing action, used at the foot of every documentation page. */
export function DocCta() {
  return (
    <section className="section">
      <div className="container">
        <div className="prose">
          <h2>Run it on a real address</h2>
          <p>
            The workstation is the fastest way to see whether these claims hold. Trace any
            Ethereum or Tron wallet and the graph, the attribution and the risk breakdown
            are produced by the same service described on this page.
          </p>
          <div className="doc-actions">
            <Link className="btn btn--primary btn--lg" to="/investigate">
              Open the workstation
              <ArrowRight size={16} aria-hidden />
            </Link>
            <Link className="btn btn--ghost btn--lg" to="/request-demo">
              Request a walkthrough
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

/** The section named in the URL hash, or the first section when the hash is empty. */
function hashSection(sections: DocSection[]): string {
  const hash = window.location.hash.replace('#', '');
  return sections.some((s) => s.id === hash) ? hash : sections[0]?.id ?? '';
}
