import Hero from '../components/marketing/Hero';
import NetworkStrip from '../components/marketing/NetworkStrip';
import ProblemSection from '../components/marketing/ProblemSection';
import WorkflowSection from '../components/marketing/WorkflowSection';
import FollowFlow from '../components/marketing/FollowFlow';
import FundFlowSection from '../components/marketing/FundFlowSection';
import AttributionSection from '../components/marketing/AttributionSection';
import RiskSection from '../components/marketing/RiskSection';
import ChainShowcase from '../components/marketing/ChainShowcase';
import ProductPreview from '../components/marketing/ProductPreview';
import ReportSection from '../components/marketing/ReportSection';
import MetricsSection from '../components/marketing/MetricsSection';
import FinalCta from '../components/marketing/FinalCta';

/**
 * The landing page.
 *
 * One argument, told in order: here is the problem, here is the method, here is what
 * the method produces, here is what it looks like, here is the output. Every scene
 * that draws a graph draws it from the same synthetic dataset, and every one of them
 * is labelled as illustrative.
 */
export default function Landing() {
  return (
    <>
      <Hero />
      <NetworkStrip />
      <ProblemSection />
      <WorkflowSection />
      <FollowFlow />
      <FundFlowSection />
      <AttributionSection />
      <RiskSection />
      <ChainShowcase />
      <ProductPreview />
      <ReportSection />
      <MetricsSection />
      <FinalCta />
    </>
  );
}
