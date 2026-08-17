"use client";

import Link from "next/link";
import { logout } from "@/app/actions";
import { LanguageSwitch, useI18n } from "./I18nProvider";

export function HeaderBar({ current, email }: { current?: string; email?: string | null }) {
  const { t } = useI18n();
  return (
    <header className="site-header">
      <Link href="/" className="brand">
        <span className="brand-mark">{t("brand.name")}</span>
        <span className="brand-sub">{t("brand.sub")}</span>
      </Link>
      <nav className="nav" aria-label="Site">
        <Link href="/pricing" aria-current={current === "pricing" ? "page" : undefined}>
          {t("nav.pricing")}
        </Link>
        {email ? (
          <>
            <Link href="/app" aria-current={current === "app" ? "page" : undefined}>
              {t("nav.bill")}
            </Link>
            <form action={logout}>
              <button type="submit" className="btn ghost">
                {t("nav.signOut")}
              </button>
            </form>
          </>
        ) : (
          <Link href="/login" className="btn">
            {t("nav.signIn")}
          </Link>
        )}
        <LanguageSwitch compact />
      </nav>
    </header>
  );
}

export function FooterBar() {
  const { t } = useI18n();
  return (
    <footer className="site-footer">
      <p>{t("brand.footer")}</p>
      <div className="footer-links">
        <Link href="/pricing">{t("nav.pricing")}</Link>
        <Link href="/privacy">{t("nav.privacy")}</Link>
        <Link href="/login">{t("nav.signIn")}</Link>
      </div>
    </footer>
  );
}

export function AppNav({
  current,
}: {
  current: "bill" | "forecast" | "year" | "statement" | "letter" | "history" | "settings";
}) {
  const { t } = useI18n();
  const items = [
    { href: "/app", id: "bill", label: t("nav.month") },
    { href: "/app/forecast", id: "forecast", label: t("nav.forecast") },
    { href: "/app/year", id: "year", label: t("nav.year") },
    { href: "/app/statement", id: "statement", label: t("nav.statement") },
    { href: "/app/letter", id: "letter", label: t("nav.letter") },
    { href: "/app/history", id: "history", label: t("nav.history") },
    { href: "/app/settings", id: "settings", label: t("nav.settings") },
  ] as const;
  return (
    <nav className="app-nav" aria-label={t("nav.bill")}>
      {items.map((item) => (
        <Link key={item.id} href={item.href} aria-current={current === item.id ? "page" : undefined}>
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
