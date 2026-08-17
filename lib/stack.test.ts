import { describe, expect, it } from "vitest";
import type { Line } from "./types";
import {
  cancelImpact,
  clientInvoiceText,
  committedMonthly,
  expenseReportText,
  familyOf,
  findOverlaps,
  icsCalendar,
  nextCardBill,
  taxCsv,
} from "./stack";

const fx = { rate: 1, date: "2026-08-16" };
const now = new Date("2026-08-16T19:00:00Z");

function line(partial: Partial<Line> & Pick<Line, "name" | "kind" | "amountCny" | "source" | "includedInTotal">): Line {
  return { id: partial.id ?? partial.name, ...partial };
}

const stack: Line[] = [
  line({
    name: "Claude Max",
    kind: "subscription",
    amountCny: 100,
    source: "hand",
    includedInTotal: true,
    chargeDay: 1,
  }),
  line({
    name: "Cursor Pro",
    kind: "subscription",
    amountCny: 20,
    source: "hand",
    includedInTotal: true,
    chargeDay: 28,
  }),
  line({
    name: "Windsurf",
    kind: "subscription",
    amountCny: 15,
    source: "hand",
    includedInTotal: true,
    chargeDay: 20,
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
  line({
    name: "OpenAI API",
    kind: "api",
    amountCny: 40,
    amountUsd: 40,
    source: "cost_api",
    includedInTotal: true,
    category: "billable",
    dailyUsd: [
      { date: "2026-08-14", usd: 10 },
      { date: "2026-08-15", usd: 10 },
      { date: "2026-08-16", usd: 10 },
    ],
  }),
  line({
    name: "ccusage estimate",
    kind: "api",
    amountCny: 300,
    source: "ccusage_estimate",
    includedInTotal: false,
  }),
];

describe("familyOf", () => {
  it("maps common product names", () => {
    expect(familyOf("Claude Max 200")).toBe("anthropic");
    expect(familyOf("OpenAI API")).toBe("openai");
    expect(familyOf("ChatGPT Plus")).toBe("openai");
    expect(familyOf("Cursor Ultra")).toBe("cursor");
    expect(familyOf("GitHub Copilot")).toBe("copilot");
    expect(familyOf("Midjourney")).toBe("midjourney");
  });
});

describe("nextCardBill", () => {
  it("keeps estimates out and names what still hits the card", () => {
    const bill = nextCardBill(stack, fx, now);
    expect(bill.countedCny).toBe(160);
    expect(bill.remainingSubsCny).toBe(35);
    expect(bill.remainingApiCny).toBe(150);
    expect(bill.expectedMonthEndCny).toBe(345);
    expect(bill.committedMonthlyCny).toBe(155);
    expect(bill.annualRunRateCny).toBe(155 * 12 + 190 * 12);
    expect(bill.remainingCharges.map((row) => row.name)).toEqual(["Windsurf", "Cursor Pro"]);
  });
});

describe("findOverlaps", () => {
  it("flags a ChatGPT seat plus an OpenAI invoice", () => {
    const hits = findOverlaps(stack);
    expect(hits.some((hit) => hit.id === "seat-api-openai")).toBe(true);
  });

  it("flags two coding IDEs", () => {
    const hits = findOverlaps(stack);
    const ides = hits.find((hit) => hit.kind === "duplicate_ides");
    expect(ides?.names).toEqual(expect.arrayContaining(["Cursor Pro", "Windsurf"]));
  });

  it("ignores token estimates", () => {
    expect(findOverlaps(stack).every((hit) => !hit.names.includes("ccusage estimate"))).toBe(true);
  });
});

describe("cancelImpact", () => {
  it("drops a future charge from the month-end number", () => {
    const impact = cancelImpact(stack, ["Cursor Pro"], fx, now);
    expect(impact.savedCommittedCny).toBe(20);
    expect(impact.newCommittedCny).toBe(135);
    expect(impact.newExpectedMonthEndCny).toBe(325);
  });

  it("does not pretend an already-charged seat comes back this month", () => {
    const before = nextCardBill(stack, fx, now);
    const impact = cancelImpact(stack, ["Claude Max"], fx, now);
    expect(impact.savedCommittedCny).toBe(100);
    expect(impact.newCommittedCny).toBe(55);
    expect(impact.newThisMonthCny).toBe(before.countedCny);
    expect(impact.newExpectedMonthEndCny).toBe(before.expectedMonthEndCny);
  });
});

describe("exports", () => {
  it("writes a tax csv with purpose and treatment", () => {
    const csv = taxCsv(stack, now);
    expect(csv).toContain("Business expense");
    expect(csv).toContain("Personal — do not deduct");
    expect(csv).toContain("Rebillable to client");
    expect(csv).toContain("ChatGPT Plus");
    expect(csv).not.toContain("ccusage estimate");
    expect(csv).toContain("not yet");
    expect(csv).not.toMatch(/ccusage[\s\S]*Business expense/);
  });

  it("writes charge-day events", () => {
    const ics = icsCalendar(stack, now);
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("SUMMARY:AI Bill · Cursor Pro $20");
    expect(ics).toContain("DTSTART;VALUE=DATE:20260828");
    expect(ics).toContain("DTEND;VALUE=DATE:20260829");
  });

  it("builds a client invoice from billable lines only", () => {
    const text = clientInvoiceText(stack, now);
    expect(text).toContain("OpenAI API $40");
    expect(text).not.toContain("ChatGPT Plus");
    expect(text).toContain("Total $40");
  });

  it("splits an expense report by purpose", () => {
    const text = expenseReportText(stack, now);
    expect(text).toContain("Counted this month $160");
    expect(text).toContain("Work $100");
    expect(text).toContain("Personal $20");
    expect(text).toContain("Billable $40");
    expect(text).toContain("Cursor Pro $20 — not charged yet");
    expect(text).not.toContain("ccusage");
  });
});

describe("committedMonthly", () => {
  it("includes plans that have not charged yet", () => {
    expect(committedMonthly(stack)).toBe(155);
  });
});
