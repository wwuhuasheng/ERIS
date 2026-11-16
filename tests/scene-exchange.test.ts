import { describe, expect, it } from "vitest";
import { exportScene, importScene } from "../lib/scene-exchange";
import { fixedScenario } from "../lib/scenario";

describe("creator scene exchange", () => {
  it("round trips a scene without exporting private unsaid notes", () => {
    const exported = exportScene(fixedScenario);
    expect(exported).not.toContain(fixedScenario.unsaidWords);
    expect(importScene(exported)).toMatchObject({ title: fixedScenario.title, unsaidWords: "" });
  });

  it("rejects malformed or oversized files", () => {
    expect(() => importScene("{}" )).toThrow("格式不正确");
    expect(() => importScene("x".repeat(50001))).toThrow("太大");
  });
});
