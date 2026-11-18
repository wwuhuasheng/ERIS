import { describe, expect, it } from "vitest";
import { exportScene, importScene } from "../lib/scene-exchange";
import { fixedScenario } from "../lib/scenario";

describe("creator scene exchange", () => {
  it("round trips a scene without exporting private unsaid notes", () => {
    const exported = exportScene({ ...fixedScenario, memoryNote: "仅限我自己的私人记忆", memoryEnabled: true, userAvatar: "data:image/webp;base64,UklGRg==" });
    expect(exported).not.toContain(fixedScenario.unsaidWords);
    expect(exported).not.toContain("仅限我自己的私人记忆");
    expect(exported).not.toContain("UklGRg==");
    expect(importScene(exported)).toMatchObject({ title: fixedScenario.title, unsaidWords: "" });
  });

  it("rejects malformed or oversized files", () => {
    expect(() => importScene("{}" )).toThrow("格式不正确");
    expect(() => importScene("x".repeat(50001))).toThrow("太大");
  });
});
