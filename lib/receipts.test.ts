import { describe, expect, it } from "vitest";
import { sampleInboundLines } from "./inbox-sample";
import { looksLikeReceipt, merchantOf, parseReceiptDate, parseReceipts } from "./receipts";
import { upsertLine } from "./store";

const now = new Date("2026-08-16T19:00:00Z");

describe("parseReceipts", () => {
  it("reads a Stripe-style Cursor receipt", () => {
    const lines = parseReceipts(
      `Receipt from Cursor
Amount paid $20.00
Date paid August 8, 2026
Cursor Pro monthly`,
      now,
    );
    expect(lines).toHaveLength(1);
    expect(lines[0]?.name).toBe("Cursor Pro");
    expect(lines[0]?.amountCny).toBe(20);
    expect(lines[0]?.source).toBe("receipt");
    expect(lines[0]?.includedInTotal).toBe(true);
    expect(lines[0]?.chargeDay).toBe(8);
  });

  it("reads several forwarded receipts at once", () => {
    const lines = parseReceipts(
      `Receipt from Anthropic
Amount paid $100.00
August 1, 2026
Claude Max

Receipt from OpenAI
Amount paid $20.00
August 12, 2026
ChatGPT Plus`,
      now,
    );
    expect(lines.map((line) => line.name).sort()).toEqual(["ChatGPT Plus", "Claude Max"]);
  });

  it("reads a bank CSV of AI merchants", () => {
    const lines = parseReceipts(
      `Date,Description,Amount
2026-08-01,CURSOR AI,20.00
2026-08-01,ANTHROPIC CLAUDE.AI,100.00
2026-07-20,STARBUCKS,6.50
2026-08-15,OPENROUTER.AI,15.00`,
      now,
    );
    expect(lines.map((line) => `${line.name}:${line.amountCny}`).sort()).toEqual([
      "Claude Max:100",
      "Cursor Pro:20",
      "OpenRouter:15",
    ]);
  });

  it("ignores noise and unknown merchants", () => {
    expect(parseReceipts("Thanks for shopping at Costco. Total $86.12", now)).toEqual([]);
  });
});

describe("sample inbound batch", () => {
  it("lands three forwarded card charges", () => {
    const lines = sampleInboundLines(now);
    expect(lines.map((line) => `${line.name}:${line.amountCny}:${line.source}`).sort()).toEqual([
      "GitHub Copilot:10:inbox",
      "Perplexity Pro:20:inbox",
      "Windsurf:15:inbox",
    ]);
  });
});

describe("looksLikeReceipt", () => {
  it("accepts Stripe receipts and rejects marketing copy", () => {
    expect(looksLikeReceipt("Receipt from Cursor\nAmount paid $20.00")).toBe(true);
    expect(looksLikeReceipt("Introducing ChatGPT Pro — $200/month. Upgrade today.")).toBe(false);
  });
});

describe("merchantOf", () => {
  it("maps common descriptors", () => {
    expect(merchantOf("GITHUB COPILOT")?.id).toBe("copilot");
    expect(merchantOf("WINDSURF CODEIUM")?.id).toBe("windsurf");
  });
});

describe("parseReceiptDate", () => {
  it("reads ISO and named dates", () => {
    expect(parseReceiptDate("2026-08-28")?.day).toBe(28);
    expect(parseReceiptDate("August 3, 2026")?.iso).toBe("2026-08-03");
    expect(parseReceiptDate("August 3, 2026")?.explicit).toBe(true);
  });
});

describe("other-month receipts", () => {
  it("does not turn a July Stripe receipt into this month’s cash", () => {
    const lines = parseReceipts(
      `Receipt from Cursor
Amount paid $20.00
Date paid July 8, 2026
Cursor Pro monthly`,
      now,
    );
    expect(lines).toEqual([]);
  });
});

describe("cash-line dedupe", () => {
  it("treats a pasted receipt and a forwarded inbox line as the same charge", () => {
    const pasted = parseReceipts(
      `Receipt from Cursor\nAmount paid $20.00\nAugust 8, 2026`,
      now,
    )[0]!;
    const forwarded = parseReceipts(
      `Receipt from Cursor\nAmount paid $20.00\nAugust 8, 2026`,
      now,
      "inbox",
    )[0]!;
    const merged = upsertLine([pasted], forwarded);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.source).toBe("inbox");
  });

  it("replaces an onboarding hand line instead of doubling the total", () => {
    const hand = {
      id: "hand-1",
      name: "Cursor Pro",
      kind: "subscription" as const,
      amountCny: 20,
      source: "hand" as const,
      includedInTotal: true,
    };
    const forwarded = parseReceipts(
      `Receipt from Cursor\nAmount paid $20.00\nAugust 8, 2026`,
      now,
      "inbox",
    )[0]!;
    const merged = upsertLine([hand], forwarded);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.source).toBe("inbox");
  });
});
