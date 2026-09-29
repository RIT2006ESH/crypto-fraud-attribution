import { useEffect, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowUpRight, Menu, X } from 'lucide-react';
import BrandMark from '../common/BrandMark';
import { useScrolledPast } from '../../hooks/useScrolledPast';

const LINKS = [
  { to: '/platform', label: 'Platform' },
  { to: '/capabilities', label: 'Capabilities' },
  { to: '/how-it-works', label: 'How It Works' },
  { to: '/forensics', label: 'Forensics' },
  { to: '/chains', label: 'Chains' },
];

/**
 * Fixed marketing navigation.
 *
 * Transparent over the hero, then compacting to a semi-opaque blurred bar once the
 * page scrolls. The active route carries a thin accent indicator. On narrow
 * viewports the links collapse into a drawer rather than wrapping.
 */
export default function MarketingNav() {
  const scrolled = useScrolledPast(20);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const closeDrawer = () => setOpen(false);

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `m-nav__link${isActive ? ' m-nav__link--active' : ''}`;

  return (
    <header className={`m-nav${scrolled || open ? ' m-nav--scrolled' : ''}`}>
      <div className="m-nav__inner">
        <Link to="/" className="m-nav__brand" aria-label="CASETRACE home">
          <BrandMark size={24} className="m-nav__mark" />
          <span className="m-nav__word">CASETRACE</span>
        </Link>

        <nav className="m-nav__links" aria-label="Primary">
          {LINKS.map((link) => (
            <NavLink key={link.to} to={link.to} className={linkClass}>
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className="m-nav__actions">
          <Link to="/request-demo" className="btn btn--quiet btn--sm m-nav__demo">
            Request demo
          </Link>
          <Link to="/investigate" className="btn btn--primary btn--sm">
            Open workspace
            <ArrowUpRight size={14} aria-hidden />
          </Link>
          <button
            type="button"
            className="m-nav__toggle"
            aria-expanded={open}
            aria-controls="marketing-nav-drawer"
            aria-label={open ? 'Close menu' : 'Open menu'}
            onClick={() => setOpen((value) => !value)}
          >
            {open ? <X size={18} aria-hidden /> : <Menu size={18} aria-hidden />}
          </button>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            id="marketing-nav-drawer"
            className="m-nav__drawer"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="m-nav__drawer-list">
              {LINKS.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  className="m-nav__drawer-link"
                  onClick={closeDrawer}
                >
                  {link.label}
                  <ArrowUpRight size={15} aria-hidden />
                </NavLink>
              ))}
              <NavLink to="/request-demo" className="m-nav__drawer-link" onClick={closeDrawer}>
                Request demo
                <ArrowUpRight size={15} aria-hidden />
              </NavLink>
              <NavLink to="/investigate" className="m-nav__drawer-link" onClick={closeDrawer}>
                Open workspace
                <ArrowUpRight size={15} aria-hidden />
              </NavLink>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </header>
  );
}
