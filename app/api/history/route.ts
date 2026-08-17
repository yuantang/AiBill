import { NextResponse } from "next/server";
import { requireUser } from "@/lib/current-user";
import { prisma } from "@/lib/db";
import { buildLedger, monthKey, subtotals } from "@/lib/ledger";
import { toLine, toWindow } from "@/lib/lines";
import { statementText } from "@/lib/statement";
import { fetchFx } from "@/lib/fetch-costs";

export async function GET() {
  const user = await requireUser();
  if ("error" in user) return NextResponse.json({ snapshots: [] });
  const rows = await prisma.monthSnapshot.findMany({
    where: { userId: user.userId },
    orderBy: { month: "desc" },
  });
  return NextResponse.json({
    snapshots: rows.map((row) => ({
      id: row.id,
      month: row.month,
      totalCny: row.totalCny,
      subscriptionCny: row.subscriptionCny,
      apiCny: row.apiCny,
      otherCny: row.otherCny,
      statement: row.statement,
      createdAt: row.createdAt.toISOString(),
    })),
  });
}

export async function POST() {
  const user = await requireUser();
  if ("error" in user) return user.error;
  const [rows, window, fx] = await Promise.all([
    prisma.billLine.findMany({ where: { userId: user.userId } }),
    prisma.quotaWindow.findUnique({ where: { userId: user.userId } }),
    fetchFx().catch(() => null),
  ]);
  const lines = rows.map(toLine);
  const ledger = buildLedger(lines, toWindow(window), fx);
  const sums = subtotals(lines);
  const month = monthKey();
  const snapshot = await prisma.monthSnapshot.upsert({
    where: { userId_month: { userId: user.userId, month } },
    create: {
      userId: user.userId,
      month,
      totalCny: ledger.totalCny,
      subscriptionCny: sums.subscription,
      apiCny: sums.api,
      otherCny: sums.other,
      statement: statementText(ledger),
    },
    update: {
      totalCny: ledger.totalCny,
      subscriptionCny: sums.subscription,
      apiCny: sums.api,
      otherCny: sums.other,
      statement: statementText(ledger),
    },
  });
  return NextResponse.json({
    id: snapshot.id,
    month: snapshot.month,
    totalCny: snapshot.totalCny,
  });
}
