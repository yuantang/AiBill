import { NextResponse } from "next/server";
import { requireUser } from "@/lib/current-user";
import { prisma } from "@/lib/db";
import { fetchFx } from "@/lib/fetch-costs";
import { toLine, toWindow } from "@/lib/lines";
import { toSettings } from "@/lib/settings";

export async function GET() {
  const user = await requireUser();
  if ("error" in user) return NextResponse.json({ guest: true }, { status: 200 });
  const [rows, window, fx, keys, settings] = await Promise.all([
    prisma.billLine.findMany({ where: { userId: user.userId }, orderBy: { createdAt: "asc" } }),
    prisma.quotaWindow.findUnique({ where: { userId: user.userId } }),
    fetchFx().catch(() => null),
    prisma.providerKey.findMany({
      where: { userId: user.userId },
      select: { provider: true },
    }),
    prisma.userSettings.findUnique({ where: { userId: user.userId } }),
  ]);
  return NextResponse.json({
    email: user.email,
    lines: rows.map(toLine),
    window: toWindow(window),
    fx,
    hosted: Boolean(process.env.VERCEL),
    hasOpenai: keys.some((k) => k.provider === "openai"),
    hasAnthropic: keys.some((k) => k.provider === "anthropic"),
    lastInvoiceAt:
      rows
        .filter((row) => row.source === "cost_api")
        .map((row) => row.updatedAt.toISOString())
        .sort()
        .at(-1) ?? null,
    settings: toSettings(settings),
  });
}
