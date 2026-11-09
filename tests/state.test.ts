import { describe, expect, it } from "vitest";
import { applyStateChange, initialState, stateDescription } from "../lib/state";

describe("scene state", () => {
  it("clamps model deltas and absolute values", () => {
    const next = applyStateChange({ ...initialState, tension: 95, trust: 2 }, {
      tension: 1000, openness: -1000, trust: -1000, conflict: 1000, hurt: 0, expression_coverage: 1000,
    });
    expect(next).toEqual({ tension: 100, openness: 45, trust: 0, conflict: 57, hurt: 55, expression_coverage: 25 });
  });
  it("describes state without exposing scores", () => {
    expect(stateDescription({ ...initialState, tension: 85 })).toContain("紧绷");
  });
});
