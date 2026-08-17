import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { PricingView } from "@/components/PricingView";
import { pageMeta, SEO } from "@/lib/site";

export const metadata = pageMeta({
  title: SEO.pricingTitle,
  description: SEO.pricingDescription,
  path: "/pricing",
});

export default function PricingPage() {
  return (
    <>
      <SiteHeader current="pricing" />
      <PricingView />
      <SiteFooter />
    </>
  );
}
