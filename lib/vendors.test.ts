import { describe, expect, it } from "vitest";
import { BILLING_SEATS, GMAIL_FILTERS_URL, GMAIL_FORWARDING_URL } from "./vendors";

describe("BILLING_SEATS", () => {
  it("opens the three watched seats on https billing pages", () => {
    expect(BILLING_SEATS.map((seat) => seat.id)).toEqual(["cursor", "claude", "chatgpt"]);
    expect(BILLING_SEATS[0]?.from).toBe("stripe.com");
    expect(BILLING_SEATS[0]?.contains).toBe("Cursor");
  });

  it("sends unverified users to Forwarding, not Filters", () => {
    expect(GMAIL_FORWARDING_URL).toContain("#settings/fwdandpop");
    expect(GMAIL_FORWARDING_URL).not.toContain("filters");
    expect(GMAIL_FILTERS_URL).toContain("#settings/filters");
  });
});
