import { NextResponse } from "next/server";
import { requireUser } from "@/lib/current-user";
import { prisma } from "@/lib/db";
import { SAMPLE_INBOUND } from "@/lib/inbox-sample";
import { parseReceipts } from "@/lib/receipts";
import { saveReceiptLines } from "@/lib/receipt-save";

export async function POST(request: Request) {
  const user = await requireUser();
  if ("error" in user) return user.error;
  const body = (await request.json().catch(() => ({}))) as { text?: string };
  const parsed = parseReceipts(body.text?.trim() || SAMPLE_INBOUND, new Date(), "inbox");
  if (parsed.length === 0) {
    return NextResponse.json({ error: "No AI card charges found" }, { status: 422 });
  }
  const saved = await saveReceiptLines(user.userId, parsed);
  await prisma.userSettings.updateMany({
    where: { userId: user.userId },
    data: { lastInboxAt: new Date() },
  });
  return NextResponse.json({ lines: saved, saved: true });
}
