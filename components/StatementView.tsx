"use client";

import { useState } from "react";
import { csvText } from "@/lib/insights";
import { formatCny, monthKey, subtotals } from "@/lib/ledger";
import { clientInvoiceText, expenseReportText, icsCalendar, taxCsv } from "@/lib/stack";
import { statementText } from "@/lib/statement";
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

export function StatementView() {
  const { t, locale } = useI18n();
  const { ledger, ready, mode } = useBill();
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sums = subtotals(ledger.lines);
  const text = statementText(ledger, new Date(), locale);
  const canSend = ledger.totalCny > 0;

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError(t("statement.copyFail"));
    }
  }

  async function share() {
    setError(null);
    const res = await fetch("/api/share", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ statement: text, totalCny: ledger.totalCny, month: monthKey() }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? t("statement.shareFail"));
      return;
    }
    const url = `${window.location.origin}/s/${data.token}`;
    setShareUrl(url);
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      /* show url anyway */
    }
  }

  async function snapshot() {
    setError(null);
    const res = await fetch("/api/history", { method: "POST" });
    if (!res.ok) {
      setError(t("statement.saveFail"));
      return;
    }
    setSaved(true);
  }

  if (!ready) {
    return (
      <main className="page">
        <p className="hint">{t("statement.opening")}</p>
      </main>
    );
  }

  return (
    <main className="page">
      <header className="top no-print">
        <div>
          <p className="kicker">{t("statement.kicker", { month: monthKey() })}</p>
          <h1>{t("statement.title")}</h1>
        </div>
        <div className="top-actions">
          {!canSend ? (
            <p className="hint" role="status">
              {t("statement.empty")}
            </p>
          ) : null}
          <button type="button" className="btn" disabled={!canSend} onClick={() => void copy()}>
            {copied ? t("statement.copied") : t("statement.copy")}
          </button>
          <button type="button" className="btn secondary" onClick={() => window.print()}>
            {t("statement.print")}
          </button>
          <button
            type="button"
            className="btn secondary"
            onClick={() => download(`aibill-${monthKey()}.txt`, text, "text/plain")}
          >
            {t("statement.downloadTxt")}
          </button>
          <button
            type="button"
            className="btn secondary"
            onClick={() => download(`aibill-${monthKey()}.csv`, csvText(ledger.lines, locale), "text/csv")}
          >
            {t("statement.downloadCsv")}
          </button>
          <button
            type="button"
            className="btn secondary"
            onClick={() => download(`aibill-tax-${monthKey()}.csv`, taxCsv(ledger.lines, new Date(), locale), "text/csv")}
          >
            {t("statement.taxCsv")}
          </button>
          <button
            type="button"
            className="btn secondary"
            onClick={() =>
              download(`aibill-charges-${monthKey()}.ics`, icsCalendar(ledger.lines, new Date(), locale), "text/calendar")
            }
          >
            {t("statement.calendar")}
          </button>
          <button
            type="button"
            className="btn secondary"
            onClick={() =>
              download(`aibill-client-${monthKey()}.txt`, clientInvoiceText(ledger.lines, new Date(), locale), "text/plain")
            }
          >
            {t("statement.client")}
          </button>
          <button
            type="button"
            className="btn secondary"
            onClick={() =>
              download(`aibill-expense-${monthKey()}.txt`, expenseReportText(ledger.lines, new Date(), locale), "text/plain")
            }
          >
            {t("statement.expense")}
          </button>
          <button type="button" className="btn secondary" disabled={!canSend} onClick={() => void share()}>
            {shareUrl ? t("statement.shareCopied") : t("statement.share")}
          </button>
          {mode === "cloud" ? (
            <button type="button" className="btn secondary" onClick={() => void snapshot()}>
              {saved ? t("statement.saved") : t("statement.saveHistory")}
            </button>
          ) : null}
        </div>
      </header>
      <p className="hint no-print">{t("statement.hint")}</p>
      <article className="statement-sheet">
        <p className="kicker">AI Bill</p>
        <h1 style={{ marginBottom: 8 }}>{formatCny(ledger.totalCny, locale)}</h1>
        <p className="hint">
          {monthKey()}
          {ledger.fx ? ` · USD as of ${ledger.fx.date}` : ""}
        </p>
        <dl className="breakdown">
          <div>
            <dt>{t("bill.plans")}</dt>
            <dd>{formatCny(sums.subscription, locale)}</dd>
          </div>
          <div>
            <dt>{t("bill.api")}</dt>
            <dd>{formatCny(sums.api, locale)}</dd>
          </div>
          <div>
            <dt>{t("bill.other")}</dt>
            <dd>{formatCny(sums.other, locale)}</dd>
          </div>
        </dl>
        <pre>{text}</pre>
      </article>
      {shareUrl ? (
        <p className="ok no-print">
          {t("statement.shareOk")} <a href={shareUrl}>{shareUrl}</a>
        </p>
      ) : null}
      {error ? (
        <p className="error no-print" role="alert">
          {error}
        </p>
      ) : null}
    </main>
  );
}
