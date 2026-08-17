"use client";

import { useEffect, useState } from "react";
import { detectCcusageKind, parseCcusageBlocks, parseCcusageDaily, parseCcusageMonthly } from "@/lib/ccusage";
import { buildAlerts, estimateGap, monthDelta, sampleBill } from "@/lib/insights";
import {
  avgDailyApiCny,
  budgetStatus,
  categoryTotals,
  dailyApiCny,
  formatCny,
  monthKey,
  newId,
  subtotals,
  unusualApiDays,
  upcomingCharges,
} from "@/lib/ledger";
import { nextAction } from "@/lib/next-action";
import { findOverlaps, nextCardBill } from "@/lib/stack";
import { parseAnthropicCosts, parseOpenAiCosts } from "@/lib/providers";
import { parseReceipts } from "@/lib/receipts";
import { PRESETS } from "@/lib/statement";
import { DEFAULT_SETTINGS, upsertLine } from "@/lib/store";
import type { Line, LineCategory, MonthSnapshot } from "@/lib/types";
import { InboxCard } from "./InboxCard";
import { useI18n } from "./I18nProvider";
import { LineTable } from "./LineTable";
import { Onboarding } from "./Onboarding";
import { SpendChart } from "./SpendChart";
import { useBill } from "./useBill";

export function BillApp() {
  const { t, locale } = useI18n();
  const bill = useBill();
  const [openId, setOpenId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [cny, setCny] = useState("");
  const [day, setDay] = useState("1");
  const [kind, setKind] = useState<Line["kind"]>("subscription");
  const [category, setCategory] = useState<LineCategory>("work");
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [openaiKey, setOpenaiKey] = useState("");
  const [anthropicKey, setAnthropicKey] = useState("");
  const [windowPercent, setWindowPercent] = useState("");
  const [windowRemain, setWindowRemain] = useState("");
  const [budgetInput, setBudgetInput] = useState("");
  const [showConnect, setShowConnect] = useState(false);
  const [focusKeys, setFocusKeys] = useState(false);
  const [receiptText, setReceiptText] = useState("");
  const [isDemo, setIsDemo] = useState(false);
  const [previous, setPrevious] = useState<MonthSnapshot | null>(null);

  const { ledger, lines, fx, settings, ready, busy, error } = bill;
  const sums = subtotals(ledger.lines);
  const cash = ledger.lines.filter((line) => line.includedInTotal);
  const estimates = ledger.lines.filter((line) => !line.includedInTotal);
  const charges = upcomingCharges(ledger.lines);
  const series = dailyApiCny(ledger.lines, fx);
  const dailyAvg = avgDailyApiCny(ledger.lines, fx);
  const budget = budgetStatus(ledger.totalCny, settings.budgetCny, ledger.extrapolation?.cny ?? 0, dailyAvg);
  const cats = categoryTotals(ledger.lines);
  const spikes = unusualApiDays(ledger.lines);
  const empty = cash.length === 0;
  const visibleCash = cash.filter((line) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      line.name.toLowerCase().includes(q) ||
      (line.category ?? "work").includes(q) ||
      line.kind.includes(q)
    );
  });
  const gap = estimateGap(ledger.lines);
  const alerts = buildAlerts(ledger, budget, new Date(), locale);
  const compare = monthDelta(ledger.totalCny, previous);
  const forecast = nextCardBill(ledger.lines, fx);
  const overlaps = findOverlaps(ledger.lines, locale);
  const action = nextAction(ledger.lines, ledger.totalCny, locale);

  useEffect(() => {
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("demo") === "1") {
      applyDemo();
    }
    fetch("/api/history")
      .then((res) => res.json())
      .then((data) => {
        const rows = (data.snapshots ?? []) as MonthSnapshot[];
        const last = rows.find((row) => row.month !== monthKey());
        if (last) setPrevious(last);
      })
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!focusKeys || !showConnect) return;
    document.getElementById("keys")?.scrollIntoView({ behavior: "smooth", block: "start" });
    document.getElementById("openai")?.focus();
    setFocusKeys(false);
  }, [focusKeys, showConnect]);

  function openKeys() {
    setShowConnect(true);
    setFocusKeys(true);
  }

  function applyDemo() {
    const sample = sampleBill(fx);
    bill.loadBundle({
      lines: sample.lines,
      window: sample.window,
      settings: { ...DEFAULT_SETTINGS, ...settings, budgetCny: sample.settings.budgetCny ?? 1500 },
    });
    setIsDemo(true);
    bill.setError(null);
  }

  function finishOnboarding(nextLines: Line[], budgetCny: number | null) {
    bill.loadBundle({
      lines: nextLines,
      settings: { ...DEFAULT_SETTINGS, ...settings, budgetCny },
    });
    setIsDemo(false);
    openKeys();
  }

  function addLine(next: Omit<Line, "id">, id = newId()) {
    bill.putLine({ ...next, id });
    bill.setError(null);
  }

  function addHandLine() {
    const amount = Number(cny);
    if (!name.trim() || !Number.isFinite(amount) || amount < 0) {
      bill.setError(t("bill.errNameAmount"));
      return;
    }
    const chargeDay = kind === "subscription" ? Number(day) : undefined;
    addLine(
      {
        name: name.trim(),
        kind,
        amountCny: amount,
        source: "hand",
        includedInTotal: true,
        chargeDay: Number.isFinite(chargeDay) ? chargeDay : undefined,
        category,
        note:
          kind === "subscription"
            ? t("table.chargesOn", { day: String(chargeDay) })
            : t("onboard.noteApi"),
      },
      editingId ?? newId(),
    );
    setName("");
    setCny("");
    setEditingId(null);
  }

  function applyPreset(preset: (typeof PRESETS)[number]) {
    addLine({
      name: preset.name,
      kind: preset.kind,
      amountCny: preset.amountCny,
      source: "hand",
      includedInTotal: true,
      category: "work",
      chargeDay: preset.chargeDay,
      note: t("onboard.notePreset"),
    });
    setName(preset.name);
    setCny(String(preset.amountCny));
    setDay(String(preset.chargeDay));
    setKind(preset.kind);
  }

  function startEdit(line: Line) {
    setEditingId(line.id);
    setName(line.name);
    setCny(String(line.amountCny));
    setKind(line.kind);
    setDay(String(line.chargeDay ?? 1));
    setCategory(line.category ?? "work");
    setShowConnect(true);
  }

  function applyCcusagePayloads(monthly: unknown, blocks: unknown, daily?: unknown) {
    const estimatesNext = parseCcusageMonthly(monthly, monthKey(), fx);
    const days = daily ? parseCcusageDaily(daily) : [];
    if (days.length > 0 && estimatesNext[0]) {
      estimatesNext[0] = { ...estimatesNext[0], dailyUsd: days };
    }
    bill.replaceLines((prev) => {
      const kept = prev.filter((line) => line.source !== "ccusage_estimate");
      return [...kept, ...estimatesNext];
    });
    const nextWindow = parseCcusageBlocks(blocks);
    if (nextWindow) void bill.saveWindow(nextWindow);
  }

  async function runCcusage() {
    bill.setBusy("ccusage");
    bill.setError(null);
    try {
      const res = await fetch("/api/ccusage", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "ccusage failed");
      applyCcusagePayloads(data.monthly, data.blocks, data.daily);
    } catch (err) {
      bill.setError(err instanceof Error ? err.message : "ccusage failed");
    } finally {
      bill.setBusy(null);
    }
  }

  async function ingestText(raw: string) {
    const text = raw.trim();
    if (!text) {
      bill.setError(t("bill.allNone"));
      return;
    }
    bill.setBusy("ingest");
    bill.setError(null);
    try {
      if (bill.mode === "cloud") {
        const res = await fetch("/api/ingest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });
        const data = await res.json();
        if (!res.ok && !data.lines?.length) throw new Error(data.error ?? t("bill.allNone"));
        for (const line of data.lines ?? []) bill.putLine(line);
      } else {
        const lines = parseReceipts(text);
        if (lines.length === 0) throw new Error(t("bill.allNone"));
        for (const line of lines) bill.putLine(line);
      }
      setReceiptText("");
    } catch (err) {
      bill.setError(err instanceof Error ? err.message : t("bill.allNone"));
    } finally {
      bill.setBusy(null);
    }
  }

  async function refreshAllInvoices() {
    bill.setBusy("sync");
    bill.setError(null);
    try {
      await bill.refreshInvoices();
    } catch (err) {
      bill.setError(err instanceof Error ? err.message : t("bill.errSync"));
    } finally {
      bill.setBusy(null);
    }
  }

  async function onImportFile(file: File) {
    bill.setError(null);
    const raw = await file.text();
    try {
      const payload = JSON.parse(raw) as unknown;
      const kindDetected = detectCcusageKind(payload);
      if (bill.mode === "cloud") {
        const res = await fetch("/api/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ payload }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Import failed");
      }
      if (kindDetected === "blocks") {
        const nextWindow = parseCcusageBlocks(payload);
        if (nextWindow) await bill.saveWindow(nextWindow);
        else bill.setError("No active window in this blocks JSON");
        return;
      }
      if (kindDetected === "daily") {
        applyCcusagePayloads(payload, null, payload);
        return;
      }
      applyCcusagePayloads(payload, null);
    } catch {
      void ingestText(raw);
    }
  }

  async function pullCosts(provider: "openai" | "anthropic") {
    if (!fx) {
      bill.setError(t("bill.errRates"));
      return;
    }
    const key = provider === "openai" ? openaiKey : anthropicKey;
    bill.setBusy(provider);
    bill.setError(null);
    try {
      if (bill.mode === "cloud" && ((provider === "openai" && bill.hasOpenai) || (provider === "anthropic" && bill.hasAnthropic))) {
        const res = await fetch("/api/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ provider }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Sync failed");
        bill.putLine(data);
        return;
      }
      if (!key.trim()) {
        bill.setError(provider === "openai" ? t("bill.errOpenaiKey") : t("bill.errAnthropicKey"));
        return;
      }
      if (bill.mode === "cloud") {
        const saved = await fetch("/api/keys", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ provider, key }),
        });
        if (saved.ok) {
          if (provider === "openai") bill.setHasOpenai(true);
          else bill.setHasAnthropic(true);
        }
      }
      const res = await fetch("/api/costs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, key }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Fetch failed");
      const line = provider === "openai" ? parseOpenAiCosts(data, fx) : parseAnthropicCosts(data, fx);
      if (!line) throw new Error(t("bill.errNoAmount"));
      bill.putLine(upsertLine([], line)[0] ?? line);
    } catch (err) {
      bill.setError(err instanceof Error ? err.message : "Fetch failed");
    } finally {
      bill.setBusy(null);
    }
  }

  function saveHandWindow() {
    const percent = windowPercent === "" ? undefined : Number(windowPercent);
    if (percent != null && (!Number.isFinite(percent) || percent < 0 || percent > 100)) {
      bill.setError(t("bill.errWindowPct"));
      return;
    }
    void bill.saveWindow({
      label: "Claude / Cursor usage window",
      percent,
      remaining: windowRemain.trim() || undefined,
      source: "hand",
    });
    bill.setError(null);
  }

  function saveBudget() {
    const value = budgetInput.trim() === "" ? null : Number(budgetInput);
    if (value != null && (!Number.isFinite(value) || value < 0)) {
      bill.setError(t("bill.errBudget"));
      return;
    }
    void bill.persistSettings({ ...settings, budgetCny: value });
  }

  if (!ready) {
    return (
      <main className="page">
        <p className="hint">{t("bill.opening")}</p>
      </main>
    );
  }

  return (
    <main className="page">
      {bill.mode === "local" ? (
        <p className="banner">
          {t("bill.localBanner")}{" "}
          <a href="/login">{t("bill.signInForAuto")}</a>
        </p>
      ) : bill.hasOpenai || bill.hasAnthropic ? (
        <p className="hint" style={{ marginTop: 0 }}>
          {t("bill.signedIn", { email: bill.email ?? "" })}
          {bill.busy === "sync"
            ? ` · ${t("bill.refreshing")}`
            : bill.lastInvoiceAt
              ? ` · ${t("bill.lastPulled", { date: bill.lastInvoiceAt.slice(0, 10) })}`
              : ` · ${t("bill.nightlyOn")}`}
        </p>
      ) : (
        <p className="banner">
          {t("bill.needKey")}{" "}
          <button type="button" className="link" onClick={openKeys}>
            {t("bill.pasteKey")}
          </button>
        </p>
      )}

      <header className="top">
        <div>
          <p className="kicker">{t("bill.kicker", { month: monthKey() })}</p>
          <h1>{t("bill.title")}</h1>
        </div>
        <div className="top-actions">
          <a className="btn" href="/app/statement">
            {t("bill.sendNumber")}
          </a>
          <a className="btn secondary" href="/app/forecast">
            {t("nav.forecast")}
          </a>
          <a className="btn secondary" href="/app/letter">
            {t("nav.letter")}
          </a>
        </div>
      </header>
      <p className="lede">
        {t("bill.lede")}
      </p>
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}

      <section className="hero">
        <div className="hero-grid">
          <div>
            <p className="kicker">{t("bill.thisMonth")}</p>
            <p className="total">{formatCny(ledger.totalCny, locale)}</p>
          </div>
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
        </div>
        <p className="total-meta">
          {fx ? t("bill.usdAsOf", { date: fx.date }) : t("bill.loading")}
        </p>
        {budget ? (
          <div style={{ marginTop: 14 }}>
            <p className="hint">
              {t("bill.budgetLine", {
                budget: formatCny(budget.budgetCny, locale),
                left: formatCny(budget.remainingCny, locale),
              })}
              {budget.over
                ? t("bill.alreadyOver")
                : budget.weekOver
                  ? t("bill.weekOver")
                  : budget.daysToEmpty != null
                    ? t("bill.runwayDays", { n: budget.daysToEmpty })
                    : ""}
            </p>
            <div
              className={`meter${budget.over ? " over" : budget.weekOver ? " warn" : ""}`}
              aria-label="Budget"
            >
              <span style={{ width: `${Math.min(100, Math.max(2, budget.ratio * 100))}%` }} />
            </div>
          </div>
        ) : null}
        {compare ? (
          <p className="total-meta">
            {compare.deltaCny === 0
              ? t("bill.vsFlat", {
                  month: compare.previousMonth,
                  amount: formatCny(compare.previousCny, locale),
                })
              : compare.deltaCny > 0
                ? t("bill.vsUp", {
                    month: compare.previousMonth,
                    amount: formatCny(compare.previousCny, locale),
                    delta: formatCny(compare.deltaCny, locale),
                  })
                : t("bill.vsDown", {
                    month: compare.previousMonth,
                    amount: formatCny(compare.previousCny, locale),
                    delta: formatCny(-compare.deltaCny, locale),
                  })}
          </p>
        ) : null}
        {ledger.extrapolation ? (
          <p className={`forecast${budget?.weekOver ? " over" : ""}`}>
            {t("bill.weekPace", {
              days: ledger.extrapolation.daysUsed,
              amount: formatCny(ledger.extrapolation.cny, locale),
            })}
            {ledger.monthProjection
              ? t("bill.monthPace", { amount: formatCny(ledger.monthProjection.cny, locale) })
              : ""}
            {t("bill.noProject")}
          </p>
        ) : (
          <p className="total-meta">{t("bill.pullToProject")}</p>
        )}
        {cats.personal + cats.billable > 0 ? (
          <p className="total-meta">
            {t("bill.purpose", {
              work: formatCny(cats.work, locale),
              personal: formatCny(cats.personal, locale),
              billable: formatCny(cats.billable, locale),
            })}
          </p>
        ) : null}
        {spikes.length > 0 ? (
          <p className="forecast over">
            {t(spikes.length > 1 ? "bill.unusualMany" : "bill.unusualOne", {
              list: spikes.map((d) => `${d.date.slice(5)} ${formatCny(d.usd, locale)}`).join(", "),
            })}
          </p>
        ) : null}
        {!empty && forecast.remainingSubsCny + forecast.remainingApiCny > 0 ? (
          <p className="forecast">
            {t("bill.stillToHit", {
              bits: [
                forecast.remainingSubsCny > 0
                  ? t("bill.stillPlans", { amount: formatCny(forecast.remainingSubsCny, locale) })
                  : null,
                forecast.remainingApiCny > 0
                  ? t("bill.stillApi", { amount: formatCny(forecast.remainingApiCny, locale) })
                  : null,
              ]
                .filter(Boolean)
                .join(" + "),
              total: formatCny(forecast.expectedMonthEndCny, locale),
            })}
            {" · "}
            <a href="/app/forecast">{t("bill.openForecast")}</a>
          </p>
        ) : null}
        {overlaps.length > 0 ? (
          <p className="total-meta">
            {t(overlaps.length === 1 ? "bill.overlapOne" : "bill.overlapMany", {
              n: overlaps.length,
              names: overlaps[0]?.names.join(" + ") ?? "",
            })}{" "}
            <a href="/app/forecast">
              {overlaps.some((item) => item.kind !== "seat_and_api") ? t("bill.seeDrop") : t("bill.seeBoth")}
            </a>
          </p>
        ) : null}
      </section>

      <section className="panel next-action" aria-labelledby="next-job">
        <h2 id="next-job">{t("bill.nextJob")}</h2>
        <p className="next-action-title">{action.title}</p>
        <p>{action.body}</p>
        <div className="actions">
          <a className="btn" href={action.href}>
            {action.cta}
          </a>
        </div>
      </section>

      {isDemo ? (
        <p className="banner">
          {t("bill.demoBanner")}
          <button
            type="button"
            className="link"
            onClick={() => {
              bill.loadBundle({ lines: [], window: null });
              setIsDemo(false);
            }}
          >
            {t("bill.clearDemo")}
          </button>
        </p>
      ) : null}

      <section className="panel inbox-panel" id="inbox">
        <h2>{t("bill.allTitle")}</h2>
        <p className="hint">{t("bill.allHint")}</p>
        <InboxCard mode={bill.mode} onLines={(next) => next.forEach((line) => bill.putLine(line))} />
        <details className="inbox-paste">
          <summary>{t("bill.allPaste")}</summary>
          <div className="field" style={{ marginTop: 12 }}>
            <label htmlFor="receipts">{t("bill.allPaste")}</label>
            <textarea
              id="receipts"
              rows={5}
              value={receiptText}
              onChange={(e) => setReceiptText(e.target.value)}
              placeholder={t("bill.allPlaceholder")}
              style={{ width: "100%", resize: "vertical" }}
            />
          </div>
          <div className="actions">
            <button
              type="button"
              className="btn"
              disabled={busy != null}
              onClick={() => void ingestText(receiptText)}
            >
              {busy === "ingest" ? t("bill.allReading") : t("bill.allAdd")}
            </button>
            <label className="btn secondary">
              CSV / .eml
              <input
                type="file"
                accept=".csv,.txt,.eml,text/plain,text/csv"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void file.text().then((raw) => void ingestText(raw));
                  e.target.value = "";
                }}
              />
            </label>
            {bill.mode === "cloud" && (bill.hasOpenai || bill.hasAnthropic) ? (
              <button
                type="button"
                className="btn secondary"
                disabled={busy != null}
                onClick={() => void refreshAllInvoices()}
              >
                {busy === "sync" ? t("bill.pullingAll") : t("bill.pullAll")}
              </button>
            ) : null}
          </div>
        </details>
        {bill.mode === "cloud" && !showConnect ? (
          <p className="hint" style={{ marginTop: 12 }}>
            {t("bill.keysTeaser")}{" "}
            <button type="button" className="link" onClick={openKeys}>
              {t("bill.keysTeaserCta")}
            </button>
          </p>
        ) : null}
      </section>

      {showConnect ? (
        <div className="panel" id="keys" style={{ marginTop: 12 }}>
          <h2>{t("bill.invoicesTitle")}</h2>
          <p className="hint">{t("bill.invoicesHint")}</p>
          {error ? (
            <p className="error" role="alert">
              {error}
            </p>
          ) : null}
          <div className="connect">
            <div className="field">
              <label htmlFor="openai">{t("bill.openaiKey")}</label>
              <input
                id="openai"
                type="password"
                autoComplete="off"
                value={openaiKey}
                onChange={(e) => setOpenaiKey(e.target.value)}
                placeholder={bill.hasOpenai ? t("bill.keySaved") : t("bill.keyOpenaiPh")}
              />
            </div>
            <button
              type="button"
              className="btn"
              disabled={busy != null}
              onClick={() => void pullCosts("openai")}
            >
              {busy === "openai" ? t("bill.fetching") : bill.hasOpenai ? t("bill.syncOpenai") : t("bill.pullOpenai")}
            </button>
            <div className="field">
              <label htmlFor="anthropic">{t("bill.anthropicKey")}</label>
              <input
                id="anthropic"
                type="password"
                autoComplete="off"
                value={anthropicKey}
                onChange={(e) => setAnthropicKey(e.target.value)}
                placeholder={bill.hasAnthropic ? t("bill.keySaved") : "sk-ant-admin…"}
              />
            </div>
            <button
              type="button"
              className="btn"
              disabled={busy != null}
              onClick={() => void pullCosts("anthropic")}
            >
              {busy === "anthropic"
                ? t("bill.fetching")
                : bill.hasAnthropic
                  ? t("bill.syncAnthropic")
                  : t("bill.pullAnthropic")}
            </button>
          </div>
        </div>
      ) : null}

      {alerts.length > 0 && !empty ? (
        <ul className="alerts">
          {alerts.map((alert) => (
            <li key={alert.id} className={alert.level}>
              <strong>{alert.title}</strong>
              <p>{alert.body}</p>
            </li>
          ))}
        </ul>
      ) : null}

      {gap ? (
        <section className="panel gap-card">
          <h2>{t("bill.gapTitle")}</h2>
          <div className="breakdown">
            <div>
              <dt>{t("bill.gapCard")}</dt>
              <dd>{formatCny(gap.cashCny, locale)}</dd>
            </div>
            <div>
              <dt>{t("bill.gapEstimate")}</dt>
              <dd>{formatCny(gap.estimateCny, locale)}</dd>
            </div>
            <div>
              <dt>{t("bill.gapHigh")}</dt>
              <dd>{formatCny(gap.gapCny, locale)}</dd>
            </div>
          </div>
          <p className="hint">{t("bill.gapHint")}</p>
        </section>
      ) : null}

      {empty ? (
        <details className="inbox-more">
          <summary>{t("onboard.tapNow")}</summary>
          <Onboarding onDone={finishOnboarding} onDemo={applyDemo} />
        </details>
      ) : (
        <div className="card-row">
          <section className="panel">
            <h2>{t("bill.apiByDay")}</h2>
            <SpendChart series={series} />
          </section>
          <section className="panel">
            <h2>{t("bill.chargeDays")}</h2>
            {charges.length === 0 ? (
              <p className="hint">{t("bill.chargeHint")}</p>
            ) : (
              <ul className="charges">
                {charges.map((item) => (
                  <li key={`${item.name}-${item.chargeDay}`}>
                    <span>
                      {item.name}
                      <span className="hint">
                        {" "}
                        · {item.due ? t("bill.counted") : t("bill.dayN", { n: item.chargeDay })}
                      </span>
                    </span>
                    <span>{formatCny(item.amountCny, locale)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}

      {empty ? null : <section className="section">
        <h2>{t("bill.inTotal")}</h2>
        {cash.length > 2 ? (
          <div className="search-bar">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("bill.filter")}
              aria-label={t("bill.filterAria")}
            />
          </div>
        ) : null}
        {cash.length === 0 ? (
          <p className="hint">{t("bill.noCash")}</p>
        ) : (
          <LineTable
            lines={visibleCash}
            openId={openId}
            onToggle={setOpenId}
            onRemove={bill.dropLine}
            onEdit={startEdit}
          />
        )}
      </section>}

      {estimates.length > 0 ? (
        <section className="section">
          <h2>{t("bill.notInTotal")}</h2>
          <p className="hint">{t("bill.notInHint")}</p>
          <LineTable lines={estimates} openId={openId} onToggle={setOpenId} onRemove={bill.dropLine} />
        </section>
      ) : null}

      {empty ? null : <section className="section">
        <h2>{t("bill.windowTitle")}</h2>
        <div className="window">
          {ledger.window ? (
            <>
              <strong>{ledger.window.label}</strong>
              <p>
                {ledger.window.percent != null
                  ? t("bill.windowUsed", { n: ledger.window.percent })
                  : t("bill.windowInProgress")}
                {ledger.window.remaining ? t("bill.windowLeft", { left: ledger.window.remaining }) : ""}
              </p>
              {ledger.window.percent != null ? (
                <div className="meter warn" aria-hidden="true">
                  <span style={{ width: `${Math.min(100, ledger.window.percent)}%` }} />
                </div>
              ) : null}
              <p className="hint">
                {t("bill.windowNever", {
                  source:
                    ledger.window.source === "hand" ? t("bill.windowSourceHand") : t("bill.windowSourceCcusage"),
                })}
              </p>
            </>
          ) : (
            <p className="hint">{t("bill.windowEmpty")}</p>
          )}
          <div className="form compact">
            <div className="field">
              <label htmlFor="wpct">{t("bill.usedPct")}</label>
              <input
                id="wpct"
                inputMode="numeric"
                value={windowPercent}
                onChange={(e) => setWindowPercent(e.target.value)}
                placeholder="60"
              />
            </div>
            <div className="field">
              <label htmlFor="wleft">{t("bill.left")}</label>
              <input
                id="wleft"
                value={windowRemain}
                onChange={(e) => setWindowRemain(e.target.value)}
                placeholder="2h 15m"
              />
            </div>
            <button type="button" className="btn secondary" onClick={saveHandWindow}>
              {t("bill.saveWindow")}
            </button>
          </div>
        </div>
      </section>}

      {empty ? null : <section className="section">
        <div className="top">
          <h2>{editingId ? t("bill.editLine") : t("bill.addLine")}</h2>
          {empty ? null : (
          <button type="button" className="btn ghost" onClick={() => setShowConnect((v) => !v)}>
            {showConnect || editingId ? t("bill.hide") : t("bill.show")}
          </button>
          )}
        </div>
        {empty ? null : showConnect || editingId ? (
          <>
            <div className="panel" style={{ marginBottom: 12 }}>
              <h2>{t("bill.monthlyBudget")}</h2>
              <div className="form compact">
                <div className="field">
                  <label htmlFor="budget">USD</label>
                  <input
                    id="budget"
                    inputMode="decimal"
                    value={budgetInput}
                    onChange={(e) => setBudgetInput(e.target.value)}
                    placeholder={settings.budgetCny != null ? String(settings.budgetCny) : "1500"}
                  />
                </div>
                <button type="button" className="btn secondary" onClick={saveBudget}>
                  {t("bill.saveBudget")}
                </button>
              </div>
            </div>
            <div className="presets" role="group" aria-label="Common plans">
              {PRESETS.map((preset) => (
                <button key={preset.name} type="button" className="chip" onClick={() => applyPreset(preset)}>
                  {preset.name} {formatCny(preset.amountCny)}
                </button>
              ))}
            </div>
            <div className="form">
              <div className="field">
                <label htmlFor="name">{t("bill.name")}</label>
                <input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Cursor overage / Midjourney"
                />
              </div>
              <div className="field">
                <label htmlFor="cny">{t("bill.usd")}</label>
                <input id="cny" inputMode="decimal" value={cny} onChange={(e) => setCny(e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="kind">{t("bill.type")}</label>
                <select id="kind" value={kind} onChange={(e) => setKind(e.target.value as Line["kind"])}>
                  <option value="subscription">{t("kind.subscription")}</option>
                  <option value="api">{t("kind.api")}</option>
                  <option value="other">{t("kind.other")}</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="cat">{t("bill.for")}</label>
                <select id="cat" value={category} onChange={(e) => setCategory(e.target.value as LineCategory)}>
                  <option value="work">{t("category.work")}</option>
                  <option value="personal">{t("category.personal")}</option>
                  <option value="billable">{t("category.billable")}</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="day">{t("bill.chargeDay")}</label>
                <input
                  id="day"
                  inputMode="numeric"
                  value={day}
                  onChange={(e) => setDay(e.target.value)}
                  disabled={kind !== "subscription"}
                />
              </div>
            </div>
            <div className="actions">
              <button type="button" className="btn" onClick={addHandLine}>
                {editingId ? t("bill.saveLine") : t("bill.addToTotal")}
              </button>
              {editingId ? (
                <button
                  type="button"
                  className="btn secondary"
                  onClick={() => {
                    setEditingId(null);
                    setName("");
                    setCny("");
                  }}
                >
                  {t("bill.cancel")}
                </button>
              ) : null}
            </div>

            <details className="panel" style={{ marginTop: 12 }}>
              <summary>
                <strong>{t("bill.estimateOptional")}</strong>
              </summary>
              <p className="hint">{t("bill.estimateHint")}</p>
              <div className="actions">
                {bill.hosted ? null : (
                  <button type="button" className="btn secondary" disabled={busy != null} onClick={() => void runCcusage()}>
                    {busy === "ccusage" ? t("bill.readingLogs") : t("bill.runCcusage")}
                  </button>
                )}
                <label className="btn secondary">
                  {t("bill.importJson")}
                  <input
                    type="file"
                    accept="application/json"
                    hidden
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void onImportFile(file);
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>
            </details>
          </>
        ) : null}
      </section>}
    </main>
  );
}
