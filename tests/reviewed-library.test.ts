import { describe, expect, it } from "vitest";
import { reviewedScenes } from "../lib/reviewed-library";
import { presetScenarios } from "../lib/preset-scenarios";
import { scenarioSchema } from "../lib/scenario";

describe("published scene library", () => {
  it("publishes only the approved built-in scenes", () => {
    expect(reviewedScenes).toHaveLength(9);
    expect(new Set(reviewedScenes.map((scene) => scene.id)).size).toBe(reviewedScenes.length);
    expect(reviewedScenes.every((scene) => presetScenarios.includes(scene))).toBe(true);
    for (const item of reviewedScenes) {
      expect(scenarioSchema.safeParse(item.scenario).success, item.id).toBe(true);
      const publicText = [item.scenario.title, item.scenario.background, item.scenario.otherPosition, item.opening].join(" ");
      expect(publicText, item.id).not.toMatch(/(?:\+?86[- ]?)?1[3-9]\d{9}|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}|https?:\/\//);
      expect(item.scenario.userConcern.length, item.id).toBeLessThanOrEqual(500);
    }
  });
});
