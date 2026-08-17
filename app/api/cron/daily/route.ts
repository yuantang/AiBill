import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { syncProvider } from "@/lib/sync";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get("authorization");
  if (!secret || header !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const keys = await prisma.providerKey.findMany({ select: { userId: true, provider: true } });
  const results: Array<{ userId: string; provider: string; ok: boolean }> = [];
  for (const key of keys) {
    if (key.provider !== "openai" && key.provider !== "anthropic") continue;
    try {
      await syncProvider(key.userId, key.provider);
      results.push({ userId: key.userId, provider: key.provider, ok: true });
    } catch {
      results.push({ userId: key.userId, provider: key.provider, ok: false });
    }
  }
  return NextResponse.json({ ran: results.length, results });
}
