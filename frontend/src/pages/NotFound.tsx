import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Search } from 'lucide-react';
import { Link } from 'react-router-dom';

/**
 * 404. Stays inside the marketing shell so the nav is available — a dead end with no
 * way back is the one thing a 404 page must never be.
 */
export default function NotFound() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    document.title = 'Not found — CASETRACE';
  }, []);

  return (
    <section className="section doc-hero" style={{ borderBottom: 0 }}>
      <div className="container doc-hero__inner">
        <p className="eyebrow">Error 404</p>
        <h1 className="doc-hero__title">This address leads nowhere.</h1>
        <p className="lead">
          <code>{location.pathname}</code> is not a route in CASETRACE. The page may have
          moved, or the link may have been mistyped.
        </p>
        <div className="hero__actions" style={{ marginTop: 28 }}>
          <Link to="/" className="btn btn--primary">
            <ArrowLeft size={15} aria-hidden />
            Back to the overview
          </Link>
          <Link to="/investigate" className="btn btn--ghost">
            <Search size={15} aria-hidden />
            Open the workspace
          </Link>
        </div>
        <button
          type="button"
          className="btn btn--quiet"
          onClick={() => navigate(-1)}
          style={{ marginTop: 12, alignSelf: 'flex-start' }}
        >
          Go back
        </button>
      </div>
    </section>
  );
}
