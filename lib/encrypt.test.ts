import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret } from "./encrypt";

const KEY = "00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff";

describe("encryptSecret", () => {
  it("round-trips a provider key", () => {
    const packed = encryptSecret("sk-admin-test", KEY);
    expect(packed).not.toContain("sk-admin-test");
    expect(decryptSecret(packed, KEY)).toBe("sk-admin-test");
  });
});
