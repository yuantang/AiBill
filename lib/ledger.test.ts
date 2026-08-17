import { describe, expect, it } from "vitest";
import {
  budgetStatus,
  buildLedger,
  categoryTotals,
  dailyApiCny,
  daysLeftInMonth,
  daysLeftInWeek,
  prevMonthKey,
  projectMonthApiCny,
  subscriptionDueThisMonth,
  subtotals,
  totalCny,
  unusualApiDays,
  upcomingCharges,
  usdToCny,
  yearRollup,
} from "./ledger";
import { buildAlerts, csvText, estimateGap, monthDelta, sampleBill } from "./insights";
import { statementText } from "./statement";
import { detectCcusageKind, parseCcusageBlocks, parseCcusageMonthly } from "./ccusage";
import { anthropicAmountToUsd, parseOpenAiCosts } from "./providers";
import type { Line } from "./types";

const fx = { rate: 1, date: "2026-08-16" };

function line(partial: Partial<Line> & Pick<Line, "name" | "kind" | "amountCny" | "source" | "includedInTotal">): Line {
  return { id: partial.id ?? partial.name, ...partial };
}

describe("usdToCny", () => {
  it("rounds to cents", () => {
    expect(usdToCny(10, 1)).toBe(10);
    expect(usdToCny(10, 7.185)).toBe(71.85);
  });
});

describe("subscriptionDueThisMonth", () => {
  it("includes when charge day has passed", () => {
    expect(subscriptionDueThisMonth(10, new Date("2026-08-16T19:00:00Z"))).toBe(true);
  });
  it("excludes when charge day is later this month", () => {
    expect(subscriptionDueThisMonth(20, new Date("2026-08-16T19:00:00Z"))).toBe(false);
  });
  it("clamps day 31 onto the last day of a short month", () => {
    expect(subscriptionDueThisMonth(31, new Date("2026-04-30T19:00:00Z"))).toBe(true);
    expect(subscriptionDueThisMonth(31, new Date("2026-04-16T19:00:00Z"))).toBe(false);
  });
});

describe("totalCny", () => {
  const now = new Date("2026-08-16T19:00:00Z");
  it("sums only included cash lines", () => {
    const lines: Line[] = [
      line({
        name: "Claude Max",
        kind: "subscription",
        amountCny: 720,
        source: "hand",
        includedInTotal: true,
        chargeDay: 1,
      }),
      line({
        name: "OpenAI",
        kind: "api",
        amountCny: 410,
        source: "cost_api",
        includedInTotal: true,
      }),
      line({
        name: "ccusage",
        kind: "api",
        amountCny: 2400,
        source: "ccusage_estimate",
        includedInTotal: false,
      }),
    ];
    expect(totalCny(lines, now)).toBe(1130);
  });

  it("skips a subscription not yet charged this month", () => {
    const lines: Line[] = [
      line({
        name: "Cursor",
        kind: "subscription",
        amountCny: 156,
        source: "hand",
        includedInTotal: true,
        chargeDay: 28,
      }),
    ];
    expect(totalCny(lines, now)).toBe(0);
  });
});

describe("extrapolation", () => {
  it("uses last 3 API days and days left in week", () => {
    const now = new Date("2026-08-16T19:00:00Z"); // Sunday in Shanghai → 0 days left
    expect(daysLeftInWeek(now)).toBe(0);
    const monday = new Date("2026-08-17T19:00:00Z");
    expect(daysLeftInWeek(monday)).toBe(6);
    const ledger = buildLedger(
      [
        line({
          name: "OpenAI",
          kind: "api",
          amountCny: 72,
          amountUsd: 10,
          source: "cost_api",
          includedInTotal: true,
          dailyUsd: [
            { date: "2026-08-15", usd: 10 },
            { date: "2026-08-16", usd: 10 },
            { date: "2026-08-17", usd: 10 },
          ],
        }),
      ],
      null,
      fx,
      monday,
    );
    expect(ledger.extrapolation?.daysLeft).toBe(6);
    expect(ledger.extrapolation?.cny).toBe(usdToCny(60, fx.rate));
  });
});

describe("ccusage parser", () => {
  it("marks monthly cost as estimate and not in total", () => {
    const lines = parseCcusageMonthly(
      {
        monthly: [{ month: "2026-08", totalCost: 336.47 }],
        totals: { totalCost: 336.47 },
      },
      "2026-08",
      fx,
    );
    expect(lines).toHaveLength(1);
    expect(lines[0].includedInTotal).toBe(false);
    expect(lines[0].source).toBe("ccusage_estimate");
    expect(lines[0].amountUsd).toBe(336.47);
  });

  it("reads active block as a window, not money", () => {
    const window = parseCcusageBlocks({
      type: "blocks",
      data: [
        {
          isActive: true,
          timeRemaining: "2h 15m",
          totalTokens: 60,
          projectedTotal: 100,
          blockEnd: "2026-08-16T15:00:00.000Z",
        },
      ],
    });
    expect(window?.remaining).toBe("2h 15m");
    expect(window?.percent).toBe(60);
    expect(detectCcusageKind({ type: "blocks", data: [] })).toBe("blocks");
  });
});

describe("subtotals and statement", () => {
  const now = new Date("2026-08-16T19:00:00Z");
  const lines: Line[] = [
    line({
      name: "Claude Max",
      kind: "subscription",
      amountCny: 720,
      source: "hand",
      includedInTotal: true,
      chargeDay: 1,
    }),
    line({
      name: "OpenAI",
      kind: "api",
      amountCny: 410.4,
      amountUsd: 57,
      fxRate: 7.2,
      source: "cost_api",
      includedInTotal: true,
    }),
    line({
      name: "ccusage",
      kind: "api",
      amountCny: 2400,
      source: "ccusage_estimate",
      includedInTotal: false,
    }),
  ];

  it("splits cash by kind", () => {
    expect(subtotals(lines, now)).toEqual({
      subscription: 720,
      api: 410.4,
      other: 0,
    });
  });

  it("writes a bill you can send", () => {
    const text = statementText(
      buildLedger(lines, { label: "Claude Code 5 小时窗口", percent: 60, remaining: "2h", source: "ccusage" }, fx, now),
      now,
    );
    expect(text).toMatch(/This month’s AI spend: \$1,130/);
    expect(text).toContain("Claude Max $720");
    expect(text).toContain("Not in the total");
    expect(text).toContain("Usage window (not money)");
  });
});

describe("budget and calendar", () => {
  const now = new Date("2026-08-16T19:00:00Z");

  it("flags when spent plus this week would exceed budget", () => {
    const status = budgetStatus(1100, 1200, 180);
    expect(status?.over).toBe(false);
    expect(status?.weekOver).toBe(true);
    expect(status?.remainingCny).toBe(100);
    expect(status?.daysToEmpty).toBeNull();
  });

  it("estimates days until the budget is empty", () => {
    const status = budgetStatus(100, 220, 0, 20);
    expect(status?.daysToEmpty).toBe(6);
  });

  it("splits cash by work / personal / billable", () => {
    expect(
      categoryTotals(
        [
          line({
            name: "Claude Max",
            kind: "subscription",
            amountCny: 100,
            source: "hand",
            includedInTotal: true,
            chargeDay: 1,
            category: "work",
          }),
          line({
            name: "ChatGPT Plus",
            kind: "subscription",
            amountCny: 20,
            source: "hand",
            includedInTotal: true,
            chargeDay: 1,
            category: "personal",
          }),
        ],
        now,
      ),
    ).toEqual({ work: 100, personal: 20, billable: 0 });
  });

  it("flags an API day far above the median", () => {
    const flagged = unusualApiDays(
      [
        line({
          name: "OpenAI",
          kind: "api",
          amountCny: 80,
          source: "cost_api",
          includedInTotal: true,
          dailyUsd: [
            { date: "2026-08-10", usd: 4 },
            { date: "2026-08-11", usd: 5 },
            { date: "2026-08-12", usd: 4 },
            { date: "2026-08-13", usd: 6 },
            { date: "2026-08-14", usd: 40 },
          ],
        }),
      ],
      now,
    );
    expect(flagged.map((d) => d.date)).toEqual(["2026-08-14"]);
  });

  it("rolls months into a year and projects a full year", () => {
    const roll = yearRollup(
      [
        { month: "2026-07", totalCny: 160, subscriptionCny: 120, apiCny: 40, otherCny: 0 },
        { month: "2025-12", totalCny: 90, subscriptionCny: 90, apiCny: 0, otherCny: 0 },
      ],
      { month: "2026-08", totalCny: 180, subscriptionCny: 120, apiCny: 60, otherCny: 0 },
      "2026",
    );
    expect(roll.totalCny).toBe(340);
    expect(roll.months).toHaveLength(2);
    expect(roll.projectedYearCny).toBe(2040);
  });

  it("counts a mid-month cycle correctly", () => {
    const now = new Date("2026-08-16T19:00:00Z");
    expect(subscriptionDueThisMonth(20, now, 15)).toBe(false);
    expect(subscriptionDueThisMonth(15, now, 15)).toBe(true);
  });

  it("lists unpaid subscriptions later this month", () => {
    const charges = upcomingCharges(
      [
        line({
          name: "Cursor",
          kind: "subscription",
          amountCny: 156,
          source: "hand",
          includedInTotal: true,
          chargeDay: 28,
        }),
        line({
          name: "Claude Max",
          kind: "subscription",
          amountCny: 720,
          source: "hand",
          includedInTotal: true,
          chargeDay: 1,
        }),
      ],
      now,
    );
    expect(charges[0]?.name).toBe("Claude Max");
    expect(charges[0]?.due).toBe(true);
    expect(charges[1]?.daysUntil).toBe(12);
  });

  it("projects remaining month API spend from last 3 days", () => {
    const monday = new Date("2026-08-17T19:00:00Z");
    expect(daysLeftInMonth(monday)).toBe(14);
    const projection = projectMonthApiCny(
      [
        line({
          name: "OpenAI",
          kind: "api",
          amountCny: 72,
          amountUsd: 10,
          source: "cost_api",
          includedInTotal: true,
          dailyUsd: [
            { date: "2026-08-15", usd: 10 },
            { date: "2026-08-16", usd: 10 },
            { date: "2026-08-17", usd: 10 },
          ],
        }),
      ],
      fx,
      monday,
    );
    expect(projection?.daysLeft).toBe(14);
    expect(projection?.cny).toBe(usdToCny(140, fx.rate));
  });

  it("turns daily USD into a CNY series", () => {
    const series = dailyApiCny(
      [
        line({
          name: "OpenAI",
          kind: "api",
          amountCny: 72,
          source: "cost_api",
          includedInTotal: true,
          dailyUsd: [
            { date: "2026-08-15", usd: 10 },
            { date: "2026-08-16", usd: 5 },
          ],
        }),
      ],
      fx,
    );
    expect(series).toEqual([
      { date: "2026-08-15", usd: 10 },
      { date: "2026-08-16", usd: 5 },
    ]);
  });
});

describe("insights", () => {
  const now = new Date("2026-08-16T19:00:00Z");
  const lines: Line[] = [
    line({
      name: "Claude Max",
      kind: "subscription",
      amountCny: 720,
      source: "hand",
      includedInTotal: true,
      chargeDay: 1,
    }),
    line({
      name: "ccusage",
      kind: "api",
      amountCny: 2400,
      source: "ccusage_estimate",
      includedInTotal: false,
    }),
  ];

  it("names the gap between token estimate and cash", () => {
    const gap = estimateGap(lines, now);
    expect(gap?.cashCny).toBe(720);
    expect(gap?.estimateCny).toBe(2400);
    expect(gap?.gapCny).toBe(1680);
  });

  it("writes a csv a partner can open", () => {
    expect(csvText(lines).split("\n")).toHaveLength(3);
    expect(csvText(lines)).toContain("Claude Max");
    expect(csvText(lines)).toContain("no");
  });

  it("warns when estimate is much higher than cash", () => {
    const alerts = buildAlerts(buildLedger(lines, null, fx, now), null, now);
    expect(alerts.some((a) => a.id === "gap")).toBe(true);
    expect(alerts.some((a) => a.id === "no-api")).toBe(true);
  });

  it("compares to last month", () => {
    const delta = monthDelta(864, {
      id: "1",
      month: "2026-07",
      totalCny: 1000,
      subscriptionCny: 864,
      apiCny: 136,
      otherCny: 0,
      statement: "",
      createdAt: "",
    });
    expect(delta?.deltaCny).toBe(-136);
    expect(prevMonthKey(now)).toBe("2026-07");
  });

  it("builds a sample bill with estimate left out of the total", () => {
    const sample = sampleBill(fx);
    expect(totalCny(sample.lines, now)).toBeLessThan(
      sample.lines.find((l) => l.source === "ccusage_estimate")?.amountCny ?? 0,
    );
    expect(sample.settings.budgetCny).toBe(220);
  });
});

describe("provider parsers", () => {
  it("sums OpenAI cost buckets as dollars", () => {
    const line = parseOpenAiCosts(
      {
        data: [
          {
            start_time: 1755302400,
            results: [{ amount: { value: 12.5, currency: "usd" } }],
          },
          {
            start_time: 1755388800,
            results: [{ amount: { value: 7.5, currency: "usd" } }],
          },
        ],
      },
      fx,
    );
    expect(line?.includedInTotal).toBe(true);
    expect(line?.amountUsd).toBe(20);
    expect(line?.amountCny).toBe(usdToCny(20, 1));
  });

  it("treats Anthropic amount as cents", () => {
    expect(anthropicAmountToUsd({ currency: "USD", amount: "12345" })).toBe(123.45);
    expect(anthropicAmountToUsd({ value: 12.3 })).toBe(12.3);
  });
});
