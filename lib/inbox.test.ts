import { afterEach, describe, expect, it, vi } from "vitest";
import { parseReceipts } from "./receipts";
import { waitingSeats } from "./coverage";
import {
  gmailForwardConfirm,
  hydrateResendReceived,
  inboxAddress,
  inboundAllowed,
  inboundAuthorized,
  inboundDedupeKey,
  mailFromObject,
  senderAllowed,
  tokenFromRecipient,
} from "./inbox";

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

  it("only trusts known bill senders on the From line", () => {
    expect(senderAllowed("Stripe <receipts@stripe.com>")).toBe(true);
    expect(senderAllowed("evil@gmail.com")).toBe(false);
  });

  it("accepts a Gmail filter-forward whose From is the user but the body is a Stripe receipt", () => {
    expect(
      inboundAllowed({
        from: "me@gmail.com",
        text: "Fwd: Receipt from Cursor\n-----Original Message-----\nFrom: Stripe <receipts@stripe.com>\nAmount paid $20.00",
      }),
    ).toBe(true);
    expect(
      inboundAllowed({
        from: "me@gmail.com",
        text: "lunch tomorrow at the cafe",
      }),
    ).toBe(false);
  });

  it("reads a Gmail forwarding confirmation code", () => {
    const found = gmailForwardConfirm(
      "From: forwarding-noreply@google.com\nGmail Forwarding Confirmation\nConfirmation code: 847291036",
    );
    expect(found?.code).toBe("847291036");
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

  it("fetches the body when Resend only sends email.received metadata", async () => {
    const prev = process.env.RESEND_API_KEY;
    process.env.RESEND_API_KEY = "re_test";
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        to: ["ab12cd34ef@inbox.aibill.dev"],
        from: "Stripe <receipts@stripe.com>",
        subject: "Receipt from Cursor",
        text: "Receipt from Cursor\nAmount paid $20.00\nAugust 8, 2026",
        message_id: "<abc@stripe.com>",
      }),
    }));
    vi.stubGlobal("fetch", fetchMock);
    try {
      const meta = mailFromObject({
        type: "email.received",
        data: { email_id: "em_123", to: ["ab12cd34ef@inbox.aibill.dev"], subject: "Receipt from Cursor" },
      });
      expect(parseReceipts(meta.text, new Date("2026-08-16T19:00:00Z"))).toEqual([]);
      const mail = await hydrateResendReceived(meta, {
        type: "email.received",
        data: { email_id: "em_123", to: ["ab12cd34ef@inbox.aibill.dev"], subject: "Receipt from Cursor" },
      });
      expect(fetchMock).toHaveBeenCalledWith(
        "https://api.resend.com/emails/receiving/em_123",
        expect.objectContaining({ headers: { Authorization: "Bearer re_test" } }),
      );
      expect(parseReceipts(mail.text, new Date("2026-08-16T19:00:00Z"))[0]?.name).toBe("Cursor Pro");
    } finally {
      vi.unstubAllGlobals();
      if (prev === undefined) delete process.env.RESEND_API_KEY;
      else process.env.RESEND_API_KEY = prev;
    }
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

describe("inboundAuthorized", () => {
  const prevSecret = process.env.INBOX_WEBHOOK_SECRET;
  const prevVercel = process.env.VERCEL;

  afterEach(() => {
    if (prevSecret === undefined) delete process.env.INBOX_WEBHOOK_SECRET;
    else process.env.INBOX_WEBHOOK_SECRET = prevSecret;
    if (prevVercel === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = prevVercel;
  });

  it("accepts the header, bearer token, or query secret on Vercel", () => {
    process.env.VERCEL = "1";
    process.env.INBOX_WEBHOOK_SECRET = "s3cret";
    const url = "https://aibill.1024ideas.com/api/inbox";
    expect(inboundAuthorized(new Request(url))).toBe(false);
    expect(inboundAuthorized(new Request(url, { headers: { "x-inbox-secret": "s3cret" } }))).toBe(true);
    expect(inboundAuthorized(new Request(url, { headers: { authorization: "Bearer s3cret" } }))).toBe(true);
    expect(inboundAuthorized(new Request(`${url}?secret=s3cret`))).toBe(true);
    expect(inboundAuthorized(new Request(`${url}?secret=nope`))).toBe(false);
  });

  it("fails closed on Vercel when the secret is missing", () => {
    process.env.VERCEL = "1";
    delete process.env.INBOX_WEBHOOK_SECRET;
    expect(inboundAuthorized(new Request("https://aibill.1024ideas.com/api/inbox"))).toBe(false);
  });
});
