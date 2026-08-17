"use client";

import Link from "next/link";
import { PRODUCT } from "@/lib/product";
import { useI18n } from "./I18nProvider";

export function LandingPage({ signedIn }: { signedIn: boolean }) {
  const { t } = useI18n();
  const features = [
    { title: t("product.inboxTitle"), body: t("product.inbox") },
    { title: t("product.oneNumberTitle"), body: t("product.oneNumber") },
    { title: t("product.mondayTitle"), body: t("product.monday") },
  ];
  return (
    <main className="shell">
      <section className="hero-landing">
        <div className="hero-copy">
          <p className="kicker">{t("landing.kicker")}</p>
          <h1>{t("landing.title")}</h1>
          <p>{t("landing.lede")}</p>
          <div className="cta-row">
            <Link href="/app" className="btn">
              {signedIn ? t("landing.ctaOpen") : t("landing.ctaGet")}
            </Link>
            <Link href="/app?demo=1" className="btn secondary">
              {t("landing.ctaDemo")}
            </Link>
            <Link href="/pricing" className="btn secondary">
              ${PRODUCT.priceUsd}/mo
            </Link>
          </div>
        </div>
        <aside className="receipt" aria-label={t("statement.title")}>
          <div className="receipt-head">
            <span>{t("landing.receiptMonth")}</span>
            <span>{t("landing.receiptMeta")}</span>
          </div>
          <p className="kicker">{t("landing.receiptThisMonth")}</p>
          <p className="total">$184</p>
          <ul className="receipt-rows">
            <li>
              <span>{t("landing.receiptClaude")}</span>
              <span>$100</span>
            </li>
            <li>
              <span>{t("landing.receiptOpenAI")}</span>
              <span>$64</span>
            </li>
            <li>
              <span>{t("landing.receiptCursor")}</span>
              <span>$20</span>
            </li>
            <li>
              <span>{t("landing.receiptWindow")}</span>
              <span>~60%</span>
            </li>
          </ul>
        </aside>
      </section>

      <section className="section">
        <h2>{t("landing.whyTitle")}</h2>
        <div className="grid-3">
          <article className="panel">
            <h2>{t("landing.whyTokenTitle")}</h2>
            <p>{t("landing.whyToken")}</p>
          </article>
          <article className="panel">
            <h2>{t("landing.whyVendorTitle")}</h2>
            <p>{t("landing.whyVendor")}</p>
          </article>
          <article className="panel">
            <h2>{t("landing.whyCardTitle")}</h2>
            <p>{t("landing.whyCard")}</p>
          </article>
        </div>
      </section>

      <section className="section">
        <h2>{t("landing.proTitle")}</h2>
        <div className="grid-2">
          {features.map((item) => (
            <article className="panel" key={item.title}>
              <h2>{item.title}</h2>
              <p>{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section">
        <h2>{t("landing.compareTitle")}</h2>
        <div className="compare-wrap">
          <table className="compare-table">
            <thead>
              <tr>
                <th>{t("landing.compareJob")}</th>
                <th>{t("landing.compareCcusage")}</th>
                <th>{t("landing.compareVendor")}</th>
                <th>{t("landing.compareUs")}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{t("landing.jobCard")}</td>
                <td>{t("landing.jobCardCcusage")}</td>
                <td>{t("landing.jobCardVendor")}</td>
                <td>{t("landing.jobCardUs")}</td>
              </tr>
              <tr>
                <td>{t("landing.jobSend")}</td>
                <td>{t("landing.jobSendCcusage")}</td>
                <td>{t("landing.jobSendVendor")}</td>
                <td>{t("landing.jobSendUs")}</td>
              </tr>
              <tr>
                <td>{t("landing.jobNext")}</td>
                <td>{t("landing.jobNextCcusage")}</td>
                <td>{t("landing.jobNextVendor")}</td>
                <td>{t("landing.jobNextUs")}</td>
              </tr>
              <tr>
                <td>{t("landing.jobTwice")}</td>
                <td>{t("landing.jobTwiceNo")}</td>
                <td>{t("landing.jobTwiceNo")}</td>
                <td>{t("landing.jobTwiceUs")}</td>
              </tr>
              <tr>
                <td>{t("landing.jobTax")}</td>
                <td>{t("landing.jobTaxCcusage")}</td>
                <td>{t("landing.jobTaxVendor")}</td>
                <td>{t("landing.jobTaxUs")}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="section">
        <h2>{t("landing.stepsTitle")}</h2>
        <ol className="steps">
          <li>{t("landing.step1")}</li>
          <li>{t("landing.step2")}</li>
          <li>{t("landing.step3")}</li>
          <li>{t("landing.step4")}</li>
        </ol>
      </section>
    </main>
  );
}
