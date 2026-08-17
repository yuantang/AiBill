import { NextResponse } from "next/server";
import { requireUser } from "@/lib/current-user";
import { prisma } from "@/lib/db";

export async function DELETE() {
  const user = await requireUser();
  if ("error" in user) return user.error;
  await prisma.user.delete({ where: { id: user.userId } });
  return NextResponse.json({ ok: true });
}
