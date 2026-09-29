import { ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import BrandMark from '../common/BrandMark';

/**
 * Marketing footer. Four columns, then the one disclaimer that actually matters:
 * risk indicators are triage signals, not findings of fact.
 */

const COLUMNS = [
  {
    title: 'Product',
    links: [
      { to: '/platform', label: 'Platform' },
      { to: '/capabilities', label: 'Capabilities' },
      { to: '/investigate', label: 'Workspace' },
      { to: '/how-it-works', label: 'How it works' },
    ],
  },
  {
    title: 'Method',
    links: [
      { to: '/how-it-works', label: 'Trace pipeline' },
      { to: '/forensics', label: 'Forensic analysis' },
      { to: '/provenance', label: 'Data provenance' },
      { to: '/capabilities#risk', label: 'Risk model' },
    ],
  },
  {
    title: 'Coverage',
    links: [
      { to: '/chains', label: 'Supported chains' },
      { to: '/chains#limits', label: 'Limits & scope' },
      { to: '/request-demo', label: 'Request a demo' },
    ],
  },
] as const;

export default function MarketingFooter() {
  return (
    <footer className="m-footer">
      <div className="container">
        <div className="m-footer__top">
          <div className="m-footer__brand">
            <Link
              to="/"
              className="m-nav__brand"
              style={{ color: 'var(--text-primary)' }}
              aria-label="CASETRACE home"
            >
              <BrandMark size={24} className="m-nav__mark" />
              <span className="m-nav__word">CASETRACE</span>
            </Link>
            <p className="m-footer__tag">
              On-chain fund-flow analysis and entity attribution for cryptocurrency
              investigations. Built for analysts who have to show their working.
            </p>
          </div>

          {COLUMNS.map((column) => (
            <div key={column.title}>
              <h2 className="m-footer__col-title">{column.title}</h2>
              <ul className="m-footer__list" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {column.links.map((link) => (
                  <li key={link.to + link.label}>
                    <Link to={link.to} className="m-footer__link">
                      {link.label}
                      <ArrowUpRight
                        size={12}
                        className="m-footer__link-arrow"
                        aria-hidden
                        style={{ marginLeft: 4, verticalAlign: '-1px', opacity: 0.5 }}
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="m-footer__legal">
          <p className="m-footer__disclaimer">
            Risk indicators produced by this tool are triage signals derived from
            observable on-chain behaviour. They are not a determination of wrongdoing
            and should not be treated as such. Attribution labels are sourced from
            public datasets and carry the confidence published with them; verify
            independently before relying on any label. All data shown on this site is
            synthetic and illustrative.
          </p>
          <span className="m-footer__copy">© {new Date().getFullYear()} CASETRACE</span>
        </div>
      </div>
    </footer>
  );
}
