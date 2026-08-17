import { NextResponse } from "next/server";
import { requireUser } from "@/lib/current-user";
import { prisma } from "@/lib/db";
import { waitingSeats } from "@/lib/coverage";
import {
  gmailFilterQuery,
  inboxAddress,
  inboundAuthorized,
  inboundDedupeKey,
  newInboxToken,
  parseInboundRequest,
  senderAllowed,
} from "@/lib/inbox";
import { toLine } from "@/lib/lines";
import { looksLikeReceipt, parseReceipts } from "@/lib/receipts";
import { saveReceiptLines } from "@/lib/receipt-save";

async function ensureInboxToken(userId: string, rotate = false): Promise<{
  token: string;
  lastInboxAt: Date | null;
}> {
  const existing = await prisma.userSettings.findUnique({ where: { userId } });
  if (existing?.inboxToken && !rotate) {
    return { token: existing.inboxToken, lastInboxAt: existing.lastInboxAt };
  }
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const token = newInboxToken();
    try {
      const row = await prisma.userSettings.upsert({
        where: { userId },
        create: { userId, inboxToken: token },
        update: { inboxToken: token },
      });
      return { token: row.inboxToken ?? token, lastInboxAt: row.lastInboxAt };
    } catch {
      /* unique collision — try again */
    }
  }
  throw new Error("Could not allocate an inbox");
}

async function inboxPayload(userId: string, token: string, lastInboxAt: Date | null) {
  const rows = await prisma.billLine.findMany({ where: { userId, includedInTotal: true } });
  const waiting = waitingSeats(rows.map(toLine));
  return {
    address: inboxAddress(token),
    lastInboxAt: lastInboxAt?.toISOString() ?? null,
    filter: gmailFilterQuery(),
    waiting,
    setup: [
      "Copy the address.",
      "Gmail → Settings → Filters → Create a filter with the query below → Forward to this address.",
      "Or set this address as the billing email on Cursor / Claude / ChatGPT / Windsurf.",
    ],
  };
}

export async function GET() {
  const user = await requireUser();
  if ("error" in user) return user.error;
  const { token, lastInboxAt } = await ensureInboxToken(user.userId);
  return NextResponse.json(await inboxPayload(user.userId, token, lastInboxAt));
}

export async function PATCH() {
  const user = await requireUser();
  if ("error" in user) return user.error;
  const { token, lastInboxAt } = await ensureInboxToken(user.userId, true);
  return NextResponse.json(await inboxPayload(user.userId, token, lastInboxAt));
}

export async function POST(request: Request) {
  if (!inboundAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized inbound" }, { status: 401 });
  }
  const mail = await parseInboundRequest(request);
  if (!mail.token || !senderAllowed(mail.from || mail.text) || !looksLikeReceipt(mail.text)) {
    return NextResponse.json({ ignored: true });
  }
  const settings = await prisma.userSettings.findUnique({ where: { inboxToken: mail.token } });
  if (!settings) {
    return NextResponse.json({ ignored: true });
  }
  const messageKey = inboundDedupeKey(mail);
  const seen = await prisma.inboxEvent.findUnique({
    where: { userId_messageKey: { userId: settings.userId, messageKey } },
  });
  if (seen) {
    return NextResponse.json({ ignored: true });
  }
  const parsed = parseReceipts(mail.text, new Date(), "inbox");
  if (parsed.length === 0) {
    return NextResponse.json({ ignored: true });
  }
  const saved = await saveReceiptLines(settings.userId, parsed);
  await prisma.inboxEvent.create({ data: { userId: settings.userId, messageKey } });
  await prisma.userSettings.update({
    where: { userId: settings.userId },
    data: { lastInboxAt: new Date() },
  });
  return NextResponse.json({ lines: saved, saved: true });
}
