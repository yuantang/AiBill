"use client";

import { useMemo, useState } from "react";
import {
  cancelImpact,
  clientInvoiceText,
  expenseReportText,
  familyMix,
  findOverlaps,
  icsCalendar,
  nextCardBill,
  taxCsv,
} from "@/lib/stack";
import { formatCny, monthKey } from "@/lib/ledger";
import { useI18n } from "./I18nProvider";
import { useBill } from "./useBill";

function download(filename: string, body: string, type: string) {
  const blob = new Blob([body], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ForecastView() {
  const { t, locale } = useI18n();
  const { ledger, ready } = useBill();
  const [dropped, setDropped] = useState<string[]>([]);
  const [copied, setCopied] = useState<string | null>(null);
  const [copyError, setCopyError] = useState<string | null>(null);
  const forecast = useMemo(
    () => nextCardBill(ledger.lines, ledger.fx),
    [ledger.lines, ledger.fx],
  );
  const overlaps = useMemo(() => findOverlaps(ledger.lines, locale), [ledger.lines, locale]);
  const mix = useMemo(() => familyMix(ledger.lines, locale), [ledger.lines, locale]);
  const impact = useMemo(
    () => cancelImpact(ledger.lines, dropped, ledger.fx),
    [ledger.lines, dropped, ledger.fx],
  );
  const plans = ledger.lines.filter((line) => line.includedInTotal && line.kind === "subscription");
  const empty = ledger.lines.filter((line) => line.includedInTotal).length === 0;

  function toggle(id: string) {
    setDropped((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  }

  async function copy(label: string, body: string) {
    try {
      await navigator.clipboard.writeText(body);
      setCopied(label);
      setCopyError(null);
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      setCopyError(t("forecast.copyFail"));
    }
  }

  if (!ready) {
    return (
      <main className="page">
        <p className="hint">{t("forecast.opening")}</p>
      </main>
    );
  }

  return (
    <main className="page">
      <header className="top">
        <div>
          <p className="kicker">{t("forecast.kicker", { month: monthKey() })}</p>
          <h1>{t("forecast.title")}</h1>
        </div>
        <div className="top-actions">
          <button
            type="button"
            className="btn secondary"
            onClick={() =>
              download(`aibill-charges-${monthKey()}.ics`, icsCalendar(ledger.lines, new Date(), locale), "text/calendar")
            }
          >
            {t("forecast.calendar")}
          </button>
          <button
            type="button"
            className="btn secondary"
            onClick={() =>
              download(`aibill-tax-${monthKey()}.csv`, taxCsv(ledger.lines, new Date(), locale), "text/csv")
            }
          >
            {t("forecast.taxCsv")}
          </button>
        </div>
      </header>
      <p className="lede">
        {t("forecast.lede")}
      </p>

      {empty ? (
        <p className="banner">
          {t("forecast.empty")}{" "}
          <a href="/app">{t("forecast.openBill")}</a>
        </p>
      ) : null}

      <section className="hero">
        <div className="hero-grid">
          <div>
            <p className="kicker">{t("forecast.expected")}</p>
            <p className="total">{formatCny(forecast.expectedMonthEndCny, locale)}</p>
          </div>
          <dl className="breakdown">
            <div>
              <dt>{t("forecast.counted")}</dt>
              <dd>{formatCny(forecast.countedCny, locale)}</dd>
            </div>
            <div>
              <dt>{t("forecast.stillPlans")}</dt>
              <dd>{formatCny(forecast.remainingSubsCny, locale)}</dd>
            </div>
            <div>
              <dt>{t("forecast.moreApi")}</dt>
              <dd>{formatCny(forecast.remainingApiCny, locale)}</dd>
            </div>
          </dl>
        </div>
        <p className="total-meta">
          {t("forecast.runRate", {
            stack: formatCny(forecast.committedMonthlyCny, locale),
            variable: formatCny(forecast.variableSoFarCny, locale),
            year: formatCny(forecast.annualRunRateCny, locale),
          })}
        </p>
      </section>

      <div className="card-row">
        <section className="panel">
          <h2>{t("forecast.stillTitle")}</h2>
          {forecast.remainingCharges.length === 0 ? (
            <p className="hint">{t("forecast.stillEmpty")}</p>
          ) : (
            <ul className="charges">
              {forecast.remainingCharges.map((item) => (
                <li key={`${item.name}-${item.chargeDay}`}>
                  <span>
                    {item.name}
                    <span className="hint"> · {t("bill.dayN", { n: item.chargeDay })}</span>
                  </span>
                  <span>{formatCny(item.amountCny, locale)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="panel">
          <h2>{t("forecast.familyTitle")}</h2>
          {mix.length === 0 ? (
            <p className="hint">{t("forecast.familyEmpty")}</p>
          ) : (
            <ul className="charges">
              {mix.map((row) => (
                <li key={row.family}>
                  <span>
                    {row.label}
                    <span className="hint">
                      {" "}
                      · {row.count === 1 ? t("forecast.lineOne") : t("forecast.lineMany", { n: row.count })}
                    </span>
                  </span>
                  <span>{formatCny(row.amountCny, locale)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {overlaps.length > 0 ? (
        <section className="section">
          <h2>{t("forecast.twiceTitle")}</h2>
          <p className="hint">{t("forecast.twiceHint")}</p>
          <ul className="alerts">
            {overlaps.map((item) => (
              <li key={item.id} className={item.kind === "seat_and_api" ? "info" : "warn"}>
                <strong>{item.title}</strong>
                <p>{item.body}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {plans.length > 0 ? (
        <section className="section">
          <h2>{t("forecast.cancelTitle")}</h2>
          <p className="hint">{t("forecast.cancelHint")}</p>
          <div className="whatif">
            {plans.map((line) => {
              const on = dropped.includes(line.id);
              return (
                <button
                  key={line.id}
                  type="button"
                  className={`chip${on ? " on" : ""}`}
                  onClick={() => toggle(line.id)}
                  aria-pressed={on}
                >
                  {on ? t("forecast.drop", { name: line.name, amount: formatCny(line.amountCny, locale) }) : `${line.name} ${formatCny(line.amountCny, locale)}`}
                </button>
              );
            })}
          </div>
          {dropped.length > 0 ? (
            <section className="panel gap-card" style={{ marginTop: 14 }}>
              <h2>{t("forecast.newStack")}</h2>
              <dl className="breakdown">
                <div>
                  <dt>{t("forecast.saves")}</dt>
                  <dd>{formatCny(impact.savedCommittedCny, locale)}</dd>
                </div>
                <div>
                  <dt>{t("forecast.newPlans")}</dt>
                  <dd>{formatCny(impact.newCommittedCny, locale)}</dd>
                </div>
                <div>
                  <dt>{t("forecast.stillHits")}</dt>
                  <dd>{formatCny(impact.newExpectedMonthEndCny, locale)}</dd>
                </div>
              </dl>
            </section>
          ) : null}
        </section>
      ) : null}

      <section className="section">
        <h2>{t("forecast.exportTitle")}</h2>
        <p className="hint">{t("forecast.exportHint")}</p>
        <div className="actions">
          <button
            type="button"
            className="btn"
            onClick={() =>
              download(`aibill-tax-${monthKey()}.csv`, taxCsv(ledger.lines, new Date(), locale), "text/csv")
            }
          >
            {t("forecast.downloadTax")}
          </button>
          <button
            type="button"
            className="btn secondary"
            onClick={() =>
              download(`aibill-charges-${monthKey()}.ics`, icsCalendar(ledger.lines, new Date(), locale), "text/calendar")
            }
          >
            {t("forecast.addCalendar")}
          </button>
          <button
            type="button"
            className="btn secondary"
            onClick={() => void copy("invoice", clientInvoiceText(ledger.lines, new Date(), locale))}
            disabled={!ledger.lines.some((line) => line.includedInTotal && line.category === "billable")}
          >
            {copied === "invoice" ? t("forecast.copied") : t("forecast.copyInvoice")}
          </button>
          <button
            type="button"
            className="btn secondary"
            onClick={() => void copy("report", expenseReportText(ledger.lines, new Date(), locale))}
          >
            {copied === "report" ? t("forecast.copied") : t("forecast.copyReport")}
          </button>
        </div>
        {copyError ? (
          <p className="error" role="alert">
            {copyError}
          </p>
        ) : null}
      </section>
    </main>
  );
}
