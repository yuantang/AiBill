import { NextResponse } from "next/server";
import { requireUser } from "@/lib/current-user";
import { prisma } from "@/lib/db";
import { waitingSeats } from "@/lib/coverage";
import {
  gmailForwardConfirm,
  inboxAddress,
  inboxStatus,
  inboundAllowed,
  inboundAuthorized,
  inboundDedupeKey,
  newInboxToken,
  parseInboundRequest,
} from "@/lib/inbox";
import { BILLING_SEATS } from "@/lib/vendors";
import { toLine } from "@/lib/lines";
import { looksLikeReceipt, parseReceipts } from "@/lib/receipts";
import { saveReceiptLines } from "@/lib/receipt-save";

async function ensureSettings(userId: string, rotate = false) {
  const existing = await prisma.userSettings.findUnique({ where: { userId } });
  if (existing?.inboxToken && !rotate) return existing;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const token = newInboxToken();
    try {
      return await prisma.userSettings.upsert({
        where: { userId },
        create: { userId, inboxToken: token },
        update: {
          inboxToken: token,
          confirmCode: null,
          confirmLink: null,
          confirmReceivedAt: null,
          forwardingAckedAt: null,
          inboxNotice: null,
        },
      });
    } catch {
      /* unique collision */
    }
  }
  throw new Error("Could not allocate an inbox");
}

async function inboxPayload(userId: string, row: Awaited<ReturnType<typeof ensureSettings>>) {
  const lines = await prisma.billLine.findMany({ where: { userId, includedInTotal: true } });
  const status = inboxStatus(row);
  return {
    address: inboxAddress(row.inboxToken ?? ""),
    status,
    confirm:
      row.confirmReceivedAt && (row.confirmCode || row.confirmLink)
        ? {
            code: row.confirmCode,
            link: row.confirmLink,
            receivedAt: row.confirmReceivedAt.toISOString(),
          }
        : row.confirmReceivedAt
          ? { code: null, link: null, receivedAt: row.confirmReceivedAt.toISOString() }
          : null,
    lastReceiptAt: row.lastReceiptAt?.toISOString() ?? null,
    lastInboxAt: row.lastReceiptAt?.toISOString() ?? row.lastInboxAt?.toISOString() ?? null,
    waiting: waitingSeats(lines.map(toLine)),
    seats: BILLING_SEATS.map((seat) => ({ id: seat.id, name: seat.name, from: seat.from, contains: seat.contains })),
  };
}

export async function GET() {
  const user = await requireUser();
  if ("error" in user) return user.error;
  const row = await ensureSettings(user.userId);
  return NextResponse.json(await inboxPayload(user.userId, row));
}

export async function PATCH(request: Request) {
  const user = await requireUser();
  if ("error" in user) return user.error;
  let ack = false;
  try {
    const body = (await request.json()) as { ack?: boolean };
    ack = body.ack === true;
  } catch {
    ack = false;
  }
  if (ack) {
    const existing = await prisma.userSettings.findUnique({ where: { userId: user.userId } });
    if (!existing?.confirmReceivedAt || (!existing.confirmCode && !existing.confirmLink)) {
      return NextResponse.json({ error: "Nothing to confirm" }, { status: 400 });
    }
    const row = await prisma.userSettings.update({
      where: { userId: user.userId },
      data: { forwardingAckedAt: new Date() },
    });
    return NextResponse.json(await inboxPayload(user.userId, row));
  }
  const row = await ensureSettings(user.userId, true);
  return NextResponse.json(await inboxPayload(user.userId, row));
}

export async function POST(request: Request) {
  if (!inboundAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized inbound" }, { status: 401 });
  }
  const mail = await parseInboundRequest(request);
  if (!mail.token || !inboundAllowed(mail)) {
    return NextResponse.json({ ignored: true });
  }
  const settings = await prisma.userSettings.findUnique({ where: { inboxToken: mail.token } });
  if (!settings) {
    return NextResponse.json({ ignored: true });
  }
  const confirm = gmailForwardConfirm(`${mail.from}\n${mail.subject}\n${mail.text}`);
  if (confirm) {
    const bits = [
      confirm.code ? `Gmail confirmation code: ${confirm.code}` : null,
      confirm.link ? `Open this link to verify: ${confirm.link}` : null,
      !confirm.code && !confirm.link
        ? "Gmail sent a forwarding confirmation. Open the raw notice in Resend or ask support."
        : null,
    ].filter(Boolean);
    await prisma.userSettings.update({
      where: { userId: settings.userId },
      data: {
        confirmCode: confirm.code,
        confirmLink: confirm.link,
        confirmReceivedAt: new Date(),
        inboxNotice: bits.join("\n"),
      },
    });
    return NextResponse.json({ verify: true });
  }
  if (!looksLikeReceipt(mail.text)) {
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
    data: { lastInboxAt: new Date(), lastReceiptAt: new Date() },
  });
  return NextResponse.json({ lines: saved, saved: true });
}
