import { NextResponse } from "next/server";
import { detectCcusageKind, parseCcusageBlocks, parseCcusageDaily, parseCcusageMonthly } from "@/lib/ccusage";
import { requireUser } from "@/lib/current-user";
import { prisma } from "@/lib/db";
import { fetchFx } from "@/lib/fetch-costs";
import { lineWrite } from "@/lib/lines";
import { monthKey } from "@/lib/ledger";

export async function POST(request: Request) {
  const user = await requireUser();
  if ("error" in user) return user.error;
  const body = (await request.json()) as { payload?: unknown };
  if (body.payload == null) return NextResponse.json({ error: "没有 JSON" }, { status: 400 });
  const kind = detectCcusageKind(body.payload);
  const fx = await fetchFx().catch(() => null);
  if (kind === "blocks") {
    const window = parseCcusageBlocks(body.payload);
    if (!window) return NextResponse.json({ error: "没有进行中的窗口" }, { status: 400 });
    await prisma.quotaWindow.upsert({
      where: { userId: user.userId },
      create: {
        userId: user.userId,
        label: window.label,
        percent: window.percent ?? null,
        remaining: window.remaining ?? null,
        endsAt: window.endsAt ?? null,
        source: window.source,
      },
      update: {
        label: window.label,
        percent: window.percent ?? null,
        remaining: window.remaining ?? null,
        endsAt: window.endsAt ?? null,
        source: window.source,
      },
    });
    return NextResponse.json({ window });
  }
  const estimates = parseCcusageMonthly(body.payload, monthKey(), fx);
  const days = kind === "daily" ? parseCcusageDaily(body.payload) : [];
  if (days.length > 0 && estimates[0]) estimates[0] = { ...estimates[0], dailyUsd: days };
  await prisma.billLine.deleteMany({ where: { userId: user.userId, source: "ccusage_estimate" } });
  for (const line of estimates) {
    await prisma.billLine.create({ data: { userId: user.userId, ...lineWrite(line) } });
  }
  return NextResponse.json({ count: estimates.length });
}
