import { NextResponse } from "next/server";
import { requireUser } from "@/lib/current-user";
import { prisma } from "@/lib/db";
import { lineWrite, toLine } from "@/lib/lines";
import { CASH_SOURCES } from "@/lib/store";
import type { Line } from "@/lib/types";

export async function POST(request: Request) {
  const user = await requireUser();
  if ("error" in user) return user.error;
  const body = (await request.json()) as { line?: Line; replaceSame?: boolean };
  if (!body.line?.name || typeof body.line.amountCny !== "number") {
    return NextResponse.json({ error: "行不完整" }, { status: 400 });
  }
  const data = lineWrite(body.line);
  const existing = await prisma.billLine.findFirst({
    where: {
      userId: user.userId,
      name: body.line.name,
      kind: body.line.kind,
      source: CASH_SOURCES.includes(body.line.source) ? { in: [...CASH_SOURCES] } : body.line.source,
    },
  });
  const row = existing
    ? await prisma.billLine.update({ where: { id: existing.id }, data })
    : await prisma.billLine.create({ data: { userId: user.userId, ...data } });
  return NextResponse.json(toLine(row));
}

export async function DELETE(request: Request) {
  const user = await requireUser();
  if ("error" in user) return user.error;
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "缺少 id" }, { status: 400 });
  await prisma.billLine.deleteMany({ where: { id, userId: user.userId } });
  return NextResponse.json({ ok: true });
}
