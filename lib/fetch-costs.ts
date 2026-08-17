export async function fetchOpenAiCosts(key: string): Promise<unknown> {
  const now = new Date();
  const start = Math.floor(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1) / 1000);
  const url = new URL("https://api.openai.com/v1/organization/costs");
  url.searchParams.set("start_time", String(start));
  url.searchParams.set("bucket_width", "1d");
  url.searchParams.set("limit", "31");
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${key}` },
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`OpenAI 返回 ${res.status}`);
  return JSON.parse(text) as unknown;
}

export async function fetchAnthropicCosts(key: string): Promise<unknown> {
  const now = new Date();
  const starting_at = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const ending_at = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString();
  const url = new URL("https://api.anthropic.com/v1/organizations/cost_report");
  url.searchParams.set("starting_at", starting_at);
  url.searchParams.set("ending_at", ending_at);
  url.searchParams.set("bucket_width", "1d");
  url.searchParams.set("limit", "31");
  const res = await fetch(url, {
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Anthropic 返回 ${res.status}`);
  return JSON.parse(text) as unknown;
}

export async function fetchFx(): Promise<{ rate: number; date: string }> {
  return { rate: 1, date: new Date().toISOString().slice(0, 10) };
}
