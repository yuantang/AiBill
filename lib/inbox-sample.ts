import { parseReceipts } from "./receipts";
import type { Line } from "./types";

export const SAMPLE_INBOUND = `From: Stripe <receipts@stripe.com>
Subject: Receipt from Windsurf
To: you@inbox.aibill.dev

Receipt from Windsurf
Amount paid $15.00
Date paid August 8, 2026
Windsurf Pro monthly`;

export const SAMPLE_INBOUND_BATCH = `Receipt from Windsurf
Amount paid $15.00
Date paid August 8, 2026
Windsurf Pro monthly

Receipt from Perplexity
Amount paid $20.00
Date paid August 10, 2026
Perplexity Pro monthly

Receipt from GitHub Copilot
Amount paid $10.00
Date paid August 5, 2026
GitHub Copilot`;

export function sampleInboundLines(now = new Date()): Line[] {
  return parseReceipts(SAMPLE_INBOUND_BATCH, now, "inbox");
}
