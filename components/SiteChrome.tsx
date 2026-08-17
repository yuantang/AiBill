import { auth } from "@/auth";
import { AppNav, FooterBar, HeaderBar } from "./SiteChromeClient";

export async function SiteHeader({ current }: { current?: string }) {
  const session = await auth();
  return <HeaderBar current={current} email={session?.user?.email} />;
}

export function SiteFooter() {
  return <FooterBar />;
}

export { AppNav };
