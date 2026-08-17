import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { LoginCopy } from "@/components/LoginCopy";
import { LoginForm } from "@/components/LoginForm";
import { auth } from "@/auth";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) redirect("/app");
  return (
    <>
      <SiteHeader current="login" />
      <main className="narrow">
        <LoginCopy />
        <LoginForm />
      </main>
      <SiteFooter />
    </>
  );
}
