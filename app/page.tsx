import { LandingPage } from "@/components/LandingPage";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { auth } from "@/auth";
import { pageMeta, SEO, softwareJsonLd } from "@/lib/site";

export const metadata = pageMeta({
  title: SEO.title,
  description: SEO.description,
  path: "/",
});

export default async function Page() {
  const session = await auth();
  const jsonLd = softwareJsonLd();
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <SiteHeader />
      <LandingPage signedIn={Boolean(session?.user)} />
      <SiteFooter />
    </>
  );
}
