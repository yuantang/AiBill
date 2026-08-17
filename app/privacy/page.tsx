import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { PrivacyView } from "@/components/PrivacyView";
import { pageMeta, SEO } from "@/lib/site";

export const metadata = pageMeta({
  title: SEO.privacyTitle,
  description: SEO.privacyDescription,
  path: "/privacy",
});

export default function PrivacyPage() {
  return (
    <>
      <SiteHeader />
      <PrivacyView />
      <SiteFooter />
    </>
  );
}
