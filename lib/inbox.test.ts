import { describe, expect, it } from "vitest";
import { parseReceipts } from "./receipts";
import { waitingSeats } from "./coverage";
import { inboxAddress, inboundDedupeKey, mailFromObject, senderAllowed, tokenFromRecipient } from "./inbox";

describe("inbox addressing", () => {
  it("reads the token out of a recipient, plus-address, or display name", () => {
    expect(tokenFromRecipient("ab12cd34ef@inbox.aibill.dev")).toBe("ab12cd34ef");
    expect(tokenFromRecipient("AI Bill <ab12cd34ef@inbox.aibill.dev>")).toBe("ab12cd34ef");
    expect(tokenFromRecipient("receipts+ab12cd34ef@inbox.aibill.dev")).toBe("ab12cd34ef");
    expect(tokenFromRecipient("you@gmail.com, ab12cd34ef@inbox.aibill.dev")).toBe("ab12cd34ef");
    expect(tokenFromRecipient("receipts@stripe.com, ab12cd34ef@inbox.aibill.dev")).toBe("ab12cd34ef");
    expect(tokenFromRecipient("ab12cd34ef@evil.example")).toBeNull();
    expect(tokenFromRecipient("nobody")).toBeNull();
  });

  it("lists seats that have not landed as cash", () => {
    expect(waitingSeats([])).toEqual(["Claude", "Cursor", "ChatGPT"]);
    expect(
      waitingSeats([
        {
          id: "1",
          name: "Claude Max",
          kind: "subscription",
          amountCny: 100,
          source: "inbox",
          includedInTotal: true,
        },
      ]),
    ).toEqual(["Cursor", "ChatGPT"]);
  });

  it("only trusts known bill senders", () => {
    expect(senderAllowed("Stripe <receipts@stripe.com>")).toBe(true);
    expect(senderAllowed("evil@gmail.com")).toBe(false);
  });

  it("formats the public address", () => {
    expect(inboxAddress("ab12cd34ef")).toMatch(/^ab12cd34ef@/);
  });
});

describe("inbound payloads", () => {
  it("reads Mailgun form fields", () => {
    const mail = mailFromObject({
      recipient: "ab12cd34ef@inbox.aibill.dev",
      from: "Stripe <receipts@stripe.com>",
      subject: "Receipt from Cursor",
      "body-plain": "Receipt from Cursor\nAmount paid $20.00\nAugust 8, 2026",
    });
    expect(mail.token).toBe("ab12cd34ef");
    const lines = parseReceipts(mail.text, new Date("2026-08-16T19:00:00Z"));
    expect(lines[0]?.name).toBe("Cursor Pro");
    expect(lines[0]?.amountCny).toBe(20);
  });

  it("reads a Resend-style JSON envelope", () => {
    const mail = mailFromObject({
      type: "email.received",
      data: {
        to: [{ email: "ab12cd34ef@inbox.aibill.dev" }],
        from: { email: "receipts@stripe.com" },
        subject: "Receipt from Anthropic",
        text: "Receipt from Anthropic\nAmount paid $100.00\nAugust 1, 2026\nClaude Max",
      },
    });
    expect(mail.token).toBe("ab12cd34ef");
    expect(parseReceipts(mail.text, new Date("2026-08-16T19:00:00Z"))[0]?.name).toBe("Claude Max");
  });

  it("keys repeats of the same Message-Id together", () => {
    const a = mailFromObject({
      recipient: "ab12cd34ef@inbox.aibill.dev",
      from: "Stripe <receipts@stripe.com>",
      subject: "Receipt from Cursor",
      text: "Receipt from Cursor\nAmount paid $20.00",
      "Message-Id": "<abc@stripe.com>",
    });
    const b = mailFromObject({
      recipient: "ab12cd34ef@inbox.aibill.dev",
      from: "Stripe <receipts@stripe.com>",
      subject: "Receipt from Cursor",
      text: "Receipt from Cursor\nAmount paid $20.00",
      "Message-Id": "<abc@stripe.com>",
    });
    expect(inboundDedupeKey(a)).toBe(inboundDedupeKey(b));
  });

  it("ignores a grocery receipt that landed in the inbox", () => {
    const mail = mailFromObject({
      recipient: "ab12cd34ef@inbox.aibill.dev",
      text: "Thanks for shopping at Costco. Total $86.12",
    });
    expect(parseReceipts(mail.text)).toEqual([]);
  });
});
