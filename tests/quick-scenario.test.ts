import { describe, expect, it } from "vitest";
import { makeQuickScenario } from "../lib/quick-scenario";

describe("quick scenario", () => {
  it("builds a valid vent scene from three short answers", () => {
    const scene = makeQuickScenario({ event: "我们约好的事情又被临时取消了。", counterpart: "朋友", goal: "说清楚我的失望", template: "friend", intensity: 1 });
    expect(scene.mode).toBe("vent");
    expect(scene.otherRole).toBe("朋友");
    expect(scene.intensity).toBe(1);
  });

  it("rejects an empty conflict rather than inventing one", () => {
    expect(() => makeQuickScenario({ event: "", counterpart: "朋友", goal: "表达难过", template: "friend", intensity: 2 })).toThrow();
  });
});
