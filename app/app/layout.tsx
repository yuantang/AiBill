import { Shortcuts } from "@/components/Shortcuts";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";

export const metadata = {
  robots: { index: false, follow: false },
};

export default function AppSectionLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader current="app" />
      {children}
      <Shortcuts />
      <SiteFooter />
    </>
  );
}
