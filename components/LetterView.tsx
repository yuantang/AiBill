"use client";

import { useState } from "react";
import { buildAlerts, letterText } from "@/lib/insights";
import { budgetStatus, formatCny, monthKey } from "@/lib/ledger";
import { useI18n } from "./I18nProvider";
import { useBill } from "./useBill";

export function LetterView() {
  const { t, locale } = useI18n();
  const { ledger, settings, ready } = useBill();
  const [copied, setCopied] = useState(false);
  const budget = budgetStatus(ledger.totalCny, settings.budgetCny, ledger.extrapolation?.cny ?? 0);
  const alerts = buildAlerts(ledger, budget, new Date(), locale);
  const text = letterText(ledger, budget, new Date(), locale);

  if (!ready) {
    return (
      <main className="page">
        <p className="hint">{t("letter.opening")}</p>
      </main>
    );
  }

  return (
    <main className="page">
      <header className="top">
        <div>
          <p className="kicker">{t("letter.kicker", { month: monthKey() })}</p>
          <h1>{t("letter.title")}</h1>
        </div>
        <div className="top-actions">
          <button
            type="button"
            className="btn"
            onClick={() => {
              void navigator.clipboard.writeText(text).then(() => {
                setCopied(true);
                window.setTimeout(() => setCopied(false), 2000);
              });
            }}
          >
            {copied ? t("letter.copied") : t("letter.copy")}
          </button>
        </div>
      </header>
      <p className="lede">
        {t("letter.lede")}
      </p>
      {alerts.length > 0 ? (
        <ul className="alerts">
          {alerts.map((alert) => (
            <li key={alert.id} className={alert.level}>
              <strong>{alert.title}</strong>
              <p>{alert.body}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="hint">{t("letter.empty")}</p>
      )}
      <article className="statement-sheet">
        <p className="kicker">{t("letter.preview")}</p>
        <h1 style={{ fontSize: 28 }}>{t("letter.heading", { amount: formatCny(ledger.totalCny, locale) })}</h1>
        <pre>{text}</pre>
      </article>
    </main>
  );
}
