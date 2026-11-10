import { Hero } from "@/components/site/Hero";
import { Loader } from "@/components/site/Loader";
import { Solutions } from "@/components/site/Solutions";
import { Ecosystem, Features, HowItWorks } from "@/components/site/Sections";
import { Pricing } from "@/components/site/Pricing";
import { Cta, Faq } from "@/components/site/FaqCta";
import { getPlans, minPrices } from "@/lib/plans";
import { getSession } from "@/lib/auth";
import { ReviewsSection } from "@/components/site/ReviewsSection";
import { EngageSection } from "@/components/site/EngageSection";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [plans, session] = await Promise.all([getPlans(), getSession()]);
  return (
    <>
      <Loader />
      <Hero />
      <Solutions minPrice={minPrices(plans)} />
      <HowItWorks />
      <Ecosystem />
      <Features />
      <Pricing plans={plans} authed={!!session} />
      <EngageSection />
      <ReviewsSection />
      <Faq />
      <Cta />
    </>
  );
}
