import type { Line } from "./types";

export const WATCHED_SEATS = [
  { id: "claude", label: "Claude", pattern: /claude|anthropic/i },
  { id: "cursor", label: "Cursor", pattern: /cursor/i },
  { id: "chatgpt", label: "ChatGPT", pattern: /chatgpt/i },
] as const;

export function waitingSeats(lines: Line[]): string[] {
  const cash = lines.filter((line) => line.includedInTotal);
  return WATCHED_SEATS.filter((seat) => !cash.some((line) => seat.pattern.test(line.name))).map(
    (seat) => seat.label,
  );
}
