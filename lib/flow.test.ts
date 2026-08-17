import { describe, expect, it } from "vitest";
import { classifyInbound, gmailForwardConfirm, inboxStatus } from "./inbox";
import { nextAction } from "./next-action";
import { parseReceipts } from "./receipts";
import type { Line } from "./types";

const now = new Date("2026-08-17T12:00:00Z");

const GMAIL_FWD_CURSOR = `---------- Forwarded message ---------
From: Stripe <receipts@stripe.com>
Date: Sat, Aug 8, 2026
Subject: Receipt from Cursor
To: me@gmail.com

Receipt from Cursor
Amount paid $20.00
Date paid August 8, 2026
Cursor Pro monthly`;

const ZH_CONFIRM = `From: forwarding-noreply@google.com
Subject: (Gmail) 转发确认 - 从 me@gmail.com 接收邮件

https://mail-settings.google.com/mail/vf-ABC123`;

function cash(partial: Partial<Line> & Pick<Line, "id" | "name">): Line {
  return {
    kind: "subscription",
    amountCny: 20,
    source: "inbox",
    includedInTotal: true,
    ...partial,
  };
}

describe("full cash loop (simulated)", () => {
  it("walks setup states without treating confirm as cash", () => {
    expect(inboxStatus({})).toBe("unverified");
    expect(inboxStatus({ confirmReceivedAt: now })).toBe("confirm_received");
    expect(inboxStatus({ confirmReceivedAt: now, forwardingAckedAt: now })).toBe("filter_ready");
    expect(inboxStatus({ lastReceiptAt: now })).toBe("first_receipt");
  });

  it("classifies a Chinese Gmail confirm as confirm, not a receipt", () => {
    expect(classifyInbound({ from: "forwarding-noreply@google.com", subject: "(Gmail) 转发确认", text: ZH_CONFIRM })).toBe(
      "confirm",
    );
    expect(gmailForwardConfirm(ZH_CONFIRM)?.link).toMatch(/^https:\/\/mail-settings\.google\.com\//);
    expect(parseReceipts(ZH_CONFIRM, now)).toEqual([]);
    expect(nextAction([], 0).id).toBe("empty");
  });

  it("classifies a Gmail-forwarded Cursor Stripe mail as a receipt and can send that total", () => {
    expect(
      classifyInbound({
        from: "me@gmail.com",
        subject: "Fwd: Receipt from Cursor",
        text: GMAIL_FWD_CURSOR,
      }),
    ).toBe("receipt");
    const lines = parseReceipts(GMAIL_FWD_CURSOR, now, "inbox");
    expect(lines[0]?.name).toBe("Cursor Pro");
    expect(lines[0]?.amountCny).toBe(20);
    expect(lines[0]?.source).toBe("inbox");
    const action = nextAction(lines, 20);
    expect(action.id).toBe("send");
    expect(action.href).toBe("/app/statement");
  });

  it("ignores lunch mail and a pipeline probe", () => {
    expect(classifyInbound({ from: "me@gmail.com", text: "lunch tomorrow" })).toBe("ignore");
    expect(
      classifyInbound({
        from: "noreply@1024ideas.com",
        subject: "receiving verified probe",
        text: "Probe after receiving MX verified. Not a receipt.",
      }),
    ).toBe("ignore");
  });

  it("still flags two coding seats before send", () => {
    const action = nextAction(
      [cash({ id: "c", name: "Cursor Pro", amountCny: 20 }), cash({ id: "w", name: "Windsurf", amountCny: 15 })],
      35,
    );
    expect(action.id).toBe("overlap");
  });
});
