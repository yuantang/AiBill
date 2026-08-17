import { NextResponse } from "next/server";
import { requireUser } from "@/lib/current-user";
import { prisma } from "@/lib/db";
import { encryptSecret } from "@/lib/encrypt";

export async function POST(request: Request) {
  const user = await requireUser();
  if ("error" in user) return user.error;
  const body = (await request.json()) as { provider?: string; key?: string };
  if (body.provider !== "openai" && body.provider !== "anthropic") {
    return NextResponse.json({ error: "不支持这家" }, { status: 400 });
  }
  const key = body.key?.trim();
  if (!key) return NextResponse.json({ error: "缺少 key" }, { status: 400 });
  await prisma.providerKey.upsert({
    where: { userId_provider: { userId: user.userId, provider: body.provider } },
    create: { userId: user.userId, provider: body.provider, ciphertext: encryptSecret(key) },
    update: { ciphertext: encryptSecret(key) },
  });
  return NextResponse.json({ ok: true, provider: body.provider });
}

export async function DELETE(request: Request) {
  const user = await requireUser();
  if ("error" in user) return user.error;
  const provider = new URL(request.url).searchParams.get("provider");
  if (provider !== "openai" && provider !== "anthropic") {
    return NextResponse.json({ error: "不支持这家" }, { status: 400 });
  }
  await prisma.providerKey.deleteMany({ where: { userId: user.userId, provider } });
  return NextResponse.json({ ok: true });
}
