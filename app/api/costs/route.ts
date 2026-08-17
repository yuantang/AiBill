import { NextResponse } from "next/server";
import { fetchAnthropicCosts, fetchOpenAiCosts } from "@/lib/fetch-costs";

export async function POST(request: Request) {
  const body = (await request.json()) as { provider?: string; key?: string };
  const key = body.key?.trim();
  if (!key) return NextResponse.json({ error: "缺少 key" }, { status: 400 });
  try {
    if (body.provider === "openai") {
      return NextResponse.json(await fetchOpenAiCosts(key));
    }
    if (body.provider === "anthropic") {
      return NextResponse.json(await fetchAnthropicCosts(key));
    }
    return NextResponse.json({ error: "不支持这家" }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "拉取失败" },
      { status: 502 },
    );
  }
}
