import { lazy, Suspense } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import MarketingLayout from './pages/MarketingLayout';

/**
 * Route table.
 *
 * The workspace is loaded lazily: it pulls in Cytoscape and the layout plugin, which
 * is a meaningful chunk of JavaScript that a visitor reading the landing page should
 * never have to download.
 *
 * The documentation pages share a small shell, so they are bundled together.
 */

const Landing = lazy(() => import('./pages/Landing'));
const Workspace = lazy(() => import('./pages/Workspace'));
const Platform = lazy(() => import('./pages/docs/Platform'));
const Capabilities = lazy(() => import('./pages/docs/Capabilities'));
const HowItWorks = lazy(() => import('./pages/docs/HowItWorks'));
const Forensics = lazy(() => import('./pages/docs/Forensics'));
const Chains = lazy(() => import('./pages/docs/Chains'));
const Provenance = lazy(() => import('./pages/docs/Provenance'));
const RequestDemo = lazy(() => import('./pages/docs/RequestDemo'));
const NotFound = lazy(() => import('./pages/NotFound'));

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route element={<MarketingLayout />}>
            <Route index element={<Landing />} />
            <Route path="platform" element={<Platform />} />
            <Route path="capabilities" element={<Capabilities />} />
            <Route path="how-it-works" element={<HowItWorks />} />
            <Route path="forensics" element={<Forensics />} />
            <Route path="chains" element={<Chains />} />
            <Route path="provenance" element={<Provenance />} />
            <Route path="request-demo" element={<RequestDemo />} />
            <Route path="*" element={<NotFound />} />
          </Route>

          {/* The workstation is deliberately outside the marketing shell: it has its
              own masthead, no footer, and its own scrolling model. */}
          <Route path="investigate" element={<Workspace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

/** Route-transition placeholder. Deliberately near-invisible — a blank screen is
 *  worse than an unstyled one, but a spinner on every navigation is worse still. */
function RouteFallback() {
  return (
    <div className="route-fallback" role="status" aria-live="polite">
      <span className="route-fallback__bar" />
      <span className="route-fallback__label">Loading</span>
    </div>
  );
}
