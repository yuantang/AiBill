import { NextResponse } from "next/server";
import { requireUser } from "@/lib/current-user";
import { prisma } from "@/lib/db";
import { toWindow } from "@/lib/lines";
import type { QuotaWindow } from "@/lib/types";

export async function POST(request: Request) {
  const user = await requireUser();
  if ("error" in user) return user.error;
  const body = (await request.json()) as { window?: QuotaWindow | null };
  if (body.window == null) {
    await prisma.quotaWindow.deleteMany({ where: { userId: user.userId } });
    return NextResponse.json({ window: null });
  }
  const row = await prisma.quotaWindow.upsert({
    where: { userId: user.userId },
    create: {
      userId: user.userId,
      label: body.window.label,
      percent: body.window.percent ?? null,
      remaining: body.window.remaining ?? null,
      endsAt: body.window.endsAt ?? null,
      source: body.window.source,
    },
    update: {
      label: body.window.label,
      percent: body.window.percent ?? null,
      remaining: body.window.remaining ?? null,
      endsAt: body.window.endsAt ?? null,
      source: body.window.source,
    },
  });
  return NextResponse.json({ window: toWindow(row) });
}
