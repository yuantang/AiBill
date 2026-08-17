import { describe, expect, it } from "vitest";
import { nextAction } from "./next-action";
import type { Line } from "./types";

function line(partial: Partial<Line> & Pick<Line, "id" | "name">): Line {
  return {
    kind: "subscription",
    amountCny: 20,
    source: "inbox",
    includedInTotal: true,
    ...partial,
  };
}

describe("nextAction", () => {
  it("refuses to send an empty total", () => {
    const action = nextAction([], 0);
    expect(action.id).toBe("empty");
    expect(action.href).toBe("#inbox");
  });

  it("asks to drop a second IDE before sending", () => {
    const action = nextAction(
      [
        line({ id: "c", name: "Cursor Pro", amountCny: 20 }),
        line({ id: "w", name: "Windsurf", amountCny: 15 }),
      ],
      35,
    );
    expect(action.id).toBe("overlap");
    expect(action.href).toBe("/app/forecast");
    expect(action.title).toMatch(/2 coding seats|2 个/);
  });

  it("names a missing core seat", () => {
    const action = nextAction([line({ id: "c", name: "Cursor Pro" })], 20);
    expect(action.id).toBe("missing");
    expect(action.title).toMatch(/Claude|ChatGPT|Windsurf/);
  });

  it("sends the cash total when the stack is complete and not doubled", () => {
    const action = nextAction(
      [
        line({ id: "a", name: "Claude Max", amountCny: 100 }),
        line({ id: "b", name: "Cursor Pro", amountCny: 20 }),
        line({ id: "c", name: "ChatGPT Plus", amountCny: 20 }),
      ],
      140,
    );
    expect(action.id).toBe("send");
    expect(action.href).toBe("/app/statement");
    expect(action.title).toContain("140");
  });
});
