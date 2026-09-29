import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import MarketingNav from '../components/marketing/MarketingNav';
import MarketingFooter from '../components/marketing/MarketingFooter';

/**
 * Marketing shell: fixed nav, the page, the footer.
 *
 * Route changes reset scroll, because a client-side router otherwise leaves a
 * documentation page halfway down when you navigate to it from the footer.
 */
export default function MarketingLayout() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [pathname]);

  return (
    <div>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <MarketingNav />
      <main id="main">
        <Outlet />
      </main>
      <MarketingFooter />
    </div>
  );
}
