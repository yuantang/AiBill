import { prisma } from "./db";
import { decryptSecret } from "./encrypt";
import { fetchAnthropicCosts, fetchFx, fetchOpenAiCosts } from "./fetch-costs";
import { lineWrite } from "./lines";
import { parseAnthropicCosts, parseOpenAiCosts } from "./providers";
import type { Line } from "./types";

export async function syncProvider(userId: string, provider: "openai" | "anthropic") {
  const row = await prisma.providerKey.findUnique({
    where: { userId_provider: { userId, provider } },
  });
  if (!row) throw new Error(provider === "openai" ? "No OpenAI Admin Key saved" : "No Anthropic Admin Key saved");
  const key = decryptSecret(row.ciphertext);
  const fx = await fetchFx();
  const payload = provider === "openai" ? await fetchOpenAiCosts(key) : await fetchAnthropicCosts(key);
  const line: Line | null =
    provider === "openai" ? parseOpenAiCosts(payload, fx) : parseAnthropicCosts(payload, fx);
  if (!line) throw new Error("No amount in this month’s cost API");
  const existing = await prisma.billLine.findFirst({
    where: { userId, name: line.name, source: "cost_api", kind: "api" },
  });
  if (existing) {
    await prisma.billLine.update({
      where: { id: existing.id },
      data: lineWrite(line),
    });
  } else {
    await prisma.billLine.create({
      data: { userId, ...lineWrite(line) },
    });
  }
  return line;
}

export async function syncSavedProviders(userId: string): Promise<{
  lines: Line[];
  errors: Array<{ provider: string; error: string }>;
}> {
  const keys = await prisma.providerKey.findMany({
    where: { userId },
    select: { provider: true },
  });
  const lines: Line[] = [];
  const errors: Array<{ provider: string; error: string }> = [];
  for (const key of keys) {
    if (key.provider !== "openai" && key.provider !== "anthropic") continue;
    try {
      lines.push(await syncProvider(userId, key.provider));
    } catch (error) {
      errors.push({
        provider: key.provider,
        error: error instanceof Error ? error.message : "Sync failed",
      });
    }
  }
  return { lines, errors };
}
