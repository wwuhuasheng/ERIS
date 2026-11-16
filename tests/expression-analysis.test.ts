import { describe, expect, it } from "vitest";
import { observeExpression } from "../lib/expression-analysis";

describe("expression observation", () => {
  it("counts repeated user lines and ignores counterpart speech", () => {
    const result = observeExpression([
      { role: "user", content: "我希望你提前告诉我。" },
      { role: "assistant", content: "嗯，那个，我知道。" },
      { role: "user", content: "我希望你提前告诉我！" },
    ]);
    expect(result.repeatedLines).toBe(1);
    expect(result.hesitationWords).toBe(0);
    expect(result.hasRequest).toBe(true);
  });
});
