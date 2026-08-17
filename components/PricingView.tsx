"use client";

import Link from "next/link";
import { PRODUCT } from "@/lib/product";
import { useI18n } from "./I18nProvider";

export function PricingView() {
  const { t } = useI18n();
  return (
    <main className="shell" style={{ paddingBottom: 80 }}>
      <p className="kicker">{t("pricing.kicker")}</p>
      <h1>{t("pricing.title")}</h1>
      <p className="lede">{t("pricing.lede", { price: PRODUCT.priceUsd })}</p>
      <div className="grid-2">
        <article className="price-card">
          <p className="kicker">{t("pricing.freeKicker")}</p>
          <h2>{t("pricing.freeTitle")}</h2>
          <p className="price">$0</p>
          <ul>
            <li>{t("pricing.free1")}</li>
            <li>{t("pricing.free2")}</li>
            <li>{t("pricing.free3")}</li>
          </ul>
          <Link href="/app" className="btn secondary">
            {t("pricing.freeCta")}
          </Link>
        </article>
        <article className="price-card featured">
          <p className="kicker">{t("pricing.proKicker")}</p>
          <h2>{t("pricing.proTitle")}</h2>
          <p className="price">
            ${PRODUCT.priceUsd}
            <span style={{ fontSize: 16, color: "var(--muted)" }}>{t("pricing.perMonth")}</span>
          </p>
          <p className="hint" style={{ marginTop: -8, marginBottom: 12 }}>
            {t("pricing.orYear", { price: PRODUCT.priceYearUsd })}
          </p>
          <ul>
            <li>{t("pricing.pro1")}</li>
            <li>{t("pricing.pro2")}</li>
            <li>{t("pricing.pro3")}</li>
            <li>{t("pricing.pro4")}</li>
            <li>{t("pricing.pro5")}</li>
          </ul>
          <Link href="/login" className="btn">
            {t("pricing.proCta")}
          </Link>
        </article>
      </div>
      <section className="section prose">
        <h2>{t("pricing.howTitle")}</h2>
        <p>{t("pricing.how", { price: PRODUCT.priceUsd })}</p>
      </section>
    </main>
  );
}
