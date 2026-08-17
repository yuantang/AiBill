import { t, type Locale } from "./i18n";
import { dayKey, formatCny, monthKey, totalCny } from "./ledger";
import { findOverlaps, nextCardBill } from "./stack";
import { categoryLabel, kindLabel, sourceLabel, statementText } from "./statement";
import type { BudgetStatus, Ledger, Line, MonthSnapshot, QuotaWindow, UserSettings } from "./types";

export type EstimateGap = {
  cashCny: number;
  estimateCny: number;
  gapCny: number;
};

export type BillAlert = {
  id: string;
  level: "info" | "warn";
  title: string;
  body: string;
};

export function estimateGap(lines: Line[], now = new Date()): EstimateGap | null {
  const cashCny = totalCny(lines, now);
  const estimateCny = Math.round(
    lines.filter((line) => !line.includedInTotal).reduce((sum, line) => sum + line.amountCny, 0) * 100,
  ) / 100;
  if (estimateCny <= 0) return null;
  return {
    cashCny,
    estimateCny,
    gapCny: Math.round((estimateCny - cashCny) * 100) / 100,
  };
}

export function monthDelta(currentCny: number, previous: MonthSnapshot | null | undefined) {
  if (!previous) return null;
  const delta = Math.round((currentCny - previous.totalCny) * 100) / 100;
  return {
    previousMonth: previous.month,
    previousCny: previous.totalCny,
    deltaCny: delta,
  };
}

export function buildAlerts(
  ledger: Ledger,
  budget: BudgetStatus | null,
  now = new Date(),
  locale: Locale = "en",
): BillAlert[] {
  const money = (n: number) => formatCny(n, locale);
  const alerts: BillAlert[] = [];
  const gap = estimateGap(ledger.lines, now);
  if (gap && gap.gapCny > 1) {
    alerts.push({
      id: "gap",
      level: "warn",
      title: t(locale, "generated.alertGapTitle", { amount: money(gap.gapCny) }),
      body: t(locale, "generated.alertGapBody", {
        estimate: money(gap.estimateCny),
        cash: money(gap.cashCny),
      }),
    });
  }
  if (budget?.over) {
    alerts.push({
      id: "over",
      level: "warn",
      title: t(locale, "generated.alertOverTitle", { amount: money(-budget.remainingCny) }),
      body: t(locale, "generated.alertOverBody", {
        budget: money(budget.budgetCny),
        spent: money(budget.spentCny),
      }),
    });
  } else if (budget?.weekOver && ledger.extrapolation) {
    alerts.push({
      id: "week-over",
      level: "warn",
      title: t(locale, "generated.alertWeekTitle"),
      body: t(locale, "generated.alertWeekBody", {
        extra: money(ledger.extrapolation.cny),
        budget: money(budget.budgetCny),
      }),
    });
  }
  const soon = ledger.lines
    .filter((line) => line.includedInTotal && line.kind === "subscription" && line.chargeDay != null)
    .map((line) => {
      const today = Number(
        new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles", day: "2-digit" }).format(now),
      );
      const days = (line.chargeDay as number) - today;
      return { line, days };
    })
    .filter((item) => item.days > 0 && item.days <= 5);
  for (const item of soon) {
    alerts.push({
      id: `charge-${item.line.id}`,
      level: "info",
      title: t(locale, item.days === 1 ? "generated.alertChargeTitle" : "generated.alertChargeTitleMany", {
        name: item.line.name,
        n: item.days,
      }),
      body: t(locale, "generated.alertChargeBody", {
        day: String(item.line.chargeDay),
        amount: money(item.line.amountCny),
      }),
    });
  }
  if (budget && budget.daysToEmpty != null && budget.daysToEmpty > 0 && budget.daysToEmpty <= 7 && !budget.over) {
    alerts.push({
      id: "runway",
      level: "warn",
      title: t(
        locale,
        budget.daysToEmpty === 1 ? "generated.alertRunwayTitle" : "generated.alertRunwayTitleMany",
        { n: budget.daysToEmpty },
      ),
      body: t(locale, "generated.alertRunwayBody", { left: money(budget.remainingCny) }),
    });
  }
  const hasApi = ledger.lines.some((line) => line.kind === "api" && line.includedInTotal);
  if (ledger.lines.some((line) => line.includedInTotal) && !hasApi) {
    alerts.push({
      id: "no-api",
      level: "info",
      title: t(locale, "generated.alertNoApiTitle"),
      body: t(locale, "generated.alertNoApiBody"),
    });
  }
  for (const overlap of findOverlaps(ledger.lines, locale).slice(0, 2)) {
    alerts.push({
      id: overlap.id,
      level: overlap.kind === "seat_and_api" ? "info" : "warn",
      title: overlap.title,
      body: overlap.body,
    });
  }
  return alerts;
}

export function letterText(
  ledger: Ledger,
  budget: BudgetStatus | null,
  now = new Date(),
  locale: Locale = "en",
): string {
  const money = (n: number) => formatCny(n, locale);
  const alerts = buildAlerts(ledger, budget, now, locale);
  const forecast = nextCardBill(ledger.lines, ledger.fx, now);
  const parts = [t(locale, "generated.mondayTitle"), statementText(ledger, now, locale)];
  if (forecast.remainingSubsCny + forecast.remainingApiCny > 0) {
    parts.push("");
    parts.push(
      t(locale, "generated.stillHits", {
        plans: money(forecast.remainingSubsCny),
        api: money(forecast.remainingApiCny),
        total: money(forecast.expectedMonthEndCny),
      }),
    );
  }
  if (budget) {
    parts.push("");
    parts.push(
      budget.over
        ? t(locale, "generated.overBudget", { budget: money(budget.budgetCny), spent: money(budget.spentCny) })
        : budget.weekOver
          ? t(locale, "generated.weekWillPass", { budget: money(budget.budgetCny) })
          : t(locale, "generated.leftInBudget", {
              left: money(budget.remainingCny),
              budget: money(budget.budgetCny),
            }),
    );
  }
  if (alerts.length > 0) {
    parts.push("");
    parts.push(t(locale, "generated.onlyThis"));
    for (const alert of alerts) parts.push(`- ${alert.title}`);
  }
  return parts.join("\n");
}

export function csvText(lines: Line[], locale: Locale = "en"): string {
  const header = [
    t(locale, "generated.csvName"),
    t(locale, "generated.csvType"),
    t(locale, "generated.csvSource"),
    t(locale, "generated.csvPurpose"),
    t(locale, "generated.csvInTotal"),
    t(locale, "generated.csvAmount"),
    t(locale, "generated.csvInvoice"),
    t(locale, "generated.csvFx"),
    t(locale, "generated.csvChargeDay"),
    t(locale, "generated.csvNote"),
  ];
  const rows = lines.map((line) =>
    [
      line.name,
      kindLabel(line.kind, locale),
      sourceLabel(line.source, locale),
      categoryLabel(line.category ?? "work", locale),
      line.includedInTotal ? t(locale, "generated.yes") : t(locale, "generated.no"),
      String(line.amountCny),
      line.amountUsd != null ? String(line.amountUsd) : "",
      line.fxRate != null ? String(line.fxRate) : "",
      line.chargeDay != null ? String(line.chargeDay) : "",
      (line.note ?? "").replaceAll(",", "，"),
    ].join(","),
  );
  return [header.join(","), ...rows].join("\n");
}

export function sampleBill(fx: { rate: number; date: string } | null): {
  lines: Line[];
  window: QuotaWindow;
  settings: Pick<UserSettings, "budgetCny">;
} {
  const rate = 1;
  const date = fx?.date ?? monthKey();
  const today = dayKey();
  const dayMs = 24 * 60 * 60 * 1000;
  const daily = [3, 2, 1].map((ago, i) => {
    const stamp = new Date(Date.parse(`${today}T00:00:00+08:00`) - ago * dayMs);
    const key = dayKey(stamp);
    return { date: key, usd: [18, 22, 17][i] ?? 18 };
  });
  const apiUsd = daily.reduce((s, d) => s + d.usd, 0);
  return {
    settings: { budgetCny: 220 },
    window: {
      label: "Claude Code 5-hour window",
      percent: 62,
      remaining: "1h 50m",
      source: "hand",
    },
    lines: [
      {
        id: "sample-claude",
        name: "Claude Max",
        kind: "subscription",
        amountCny: 100,
        source: "inbox",
        includedInTotal: true,
        chargeDay: 1,
        category: "work",
        note: "Sample: forwarded Stripe receipt. What the card charged.",
      },
      {
        id: "sample-cursor",
        name: "Cursor Pro",
        kind: "subscription",
        amountCny: 20,
        source: "inbox",
        includedInTotal: true,
        chargeDay: 8,
        category: "work",
        note: "Sample: forwarded receipt. Change the charge day to match yours.",
      },
      {
        id: "sample-gpt",
        name: "ChatGPT Plus",
        kind: "subscription",
        amountCny: 20,
        source: "inbox",
        includedInTotal: true,
        chargeDay: 12,
        category: "personal",
        note: "Sample: forwarded seat on the same vendor as the OpenAI invoice below.",
      },
      {
        id: "sample-openai",
        name: "OpenAI API",
        kind: "api",
        amountUsd: apiUsd,
        amountCny: Math.round(apiUsd * rate * 100) / 100,
        fxRate: rate,
        fxDate: date,
        source: "cost_api",
        includedInTotal: true,
        dailyUsd: daily,
        category: "billable",
        note: "Sample: vendor invoice, not a ChatGPT subscription.",
      },
      {
        id: "sample-ccusage",
        name: "Claude Code · ccusage estimate",
        kind: "api",
        amountUsd: 336.47,
        amountCny: Math.round(336.47 * rate * 100) / 100,
        fxRate: rate,
        fxDate: date,
        source: "ccusage_estimate",
        includedInTotal: false,
        note: "Sample: list-price tokens. Usually high. Not in the total.",
      },
    ],
  };
}
