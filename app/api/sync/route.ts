import { NextResponse } from "next/server";
import { requireUser } from "@/lib/current-user";
import { syncProvider, syncSavedProviders } from "@/lib/sync";

export async function POST(request: Request) {
  const user = await requireUser();
  if ("error" in user) return user.error;
  const body = (await request.json()) as { provider?: string };
  if (body.provider === "all" || body.provider == null) {
    const result = await syncSavedProviders(user.userId);
    return NextResponse.json({
      ...result,
      lastInvoiceAt: result.lines[0] ? new Date().toISOString() : null,
    });
  }
  if (body.provider !== "openai" && body.provider !== "anthropic") {
    return NextResponse.json({ error: "Unknown provider" }, { status: 400 });
  }
  try {
    const line = await syncProvider(user.userId, body.provider);
    return NextResponse.json(line);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Sync failed" },
      { status: 502 },
    );
  }
}
