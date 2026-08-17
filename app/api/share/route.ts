import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { monthKey } from "@/lib/ledger";

export async function POST(request: Request) {
  const body = (await request.json()) as { statement?: string; totalCny?: number; month?: string };
  if (!body.statement || typeof body.totalCny !== "number") {
    return NextResponse.json({ error: "Statement is incomplete" }, { status: 400 });
  }
  try {
    const session = await auth();
    const token = randomBytes(9).toString("base64url");
    const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    const row = await prisma.shareLink.create({
      data: {
        token,
        userId: session?.user?.id ?? null,
        month: body.month || monthKey(),
        totalCny: body.totalCny,
        statement: body.statement,
        expiresAt,
      },
    });
    return NextResponse.json({ token: row.token, expiresAt: row.expiresAt.toISOString() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Share failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
