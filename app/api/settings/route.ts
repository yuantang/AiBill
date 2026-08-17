import { NextResponse } from "next/server";
import { requireUser } from "@/lib/current-user";
import { prisma } from "@/lib/db";
import { settingsWrite, toSettings } from "@/lib/settings";
import { DEFAULT_SETTINGS } from "@/lib/store";
import type { UserSettings } from "@/lib/types";

export async function GET() {
  const user = await requireUser();
  if ("error" in user) return NextResponse.json(DEFAULT_SETTINGS);
  const row = await prisma.userSettings.findUnique({ where: { userId: user.userId } });
  return NextResponse.json(toSettings(row));
}

export async function POST(request: Request) {
  const user = await requireUser();
  if ("error" in user) return user.error;
  const body = (await request.json()) as Partial<UserSettings>;
  const data = settingsWrite(body);
  const row = await prisma.userSettings.upsert({
    where: { userId: user.userId },
    create: {
      userId: user.userId,
      budgetCny: data.budgetCny ?? null,
      emailEnabled: data.emailEnabled ?? true,
      plan: data.plan ?? "free",
      theme: data.theme ?? "light",
      cycleStartDay: data.cycleStartDay ?? 1,
      locale: data.locale ?? "en",
    },
    update: data,
  });
  return NextResponse.json(toSettings(row));
}
