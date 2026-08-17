import { NextResponse } from "next/server";
import { requireUser } from "@/lib/current-user";
import { parseReceipts } from "@/lib/receipts";
import { saveReceiptLines } from "@/lib/receipt-save";

export async function POST(request: Request) {
  const body = (await request.json()) as { text?: string };
  const text = body.text?.trim() ?? "";
  if (!text) return NextResponse.json({ error: "Paste a receipt or CSV" }, { status: 400 });
  const parsed = parseReceipts(text);
  if (parsed.length === 0) {
    return NextResponse.json(
      { error: "No AI card charges found. Forward Stripe receipts or a bank CSV with Cursor / Claude / ChatGPT.", lines: [] },
      { status: 422 },
    );
  }
  const user = await requireUser();
  if ("error" in user) return NextResponse.json({ lines: parsed, saved: false });
  const saved = await saveReceiptLines(user.userId, parsed);
  return NextResponse.json({ lines: saved, saved: true });
}
