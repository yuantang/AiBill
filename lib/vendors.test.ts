import { describe, expect, it } from "vitest";
import { BILLING_SEATS } from "./vendors";

describe("BILLING_SEATS", () => {
  it("opens the three watched seats on https billing pages", () => {
    expect(BILLING_SEATS.map((seat) => seat.id)).toEqual(["cursor", "claude", "chatgpt"]);
    expect(BILLING_SEATS[0]?.from).toBe("stripe.com");
    expect(BILLING_SEATS[0]?.contains).toBe("Cursor");
    for (const seat of BILLING_SEATS) {
      expect(seat.href.startsWith("https://")).toBe(true);
    }
  });
});
