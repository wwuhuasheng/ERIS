import { describe, expect, it } from "vitest";
import fixtures from "./fixtures/qa-scenarios.json";
import { scenarioSchema } from "../lib/scenario";

describe("project-plan evaluation scenarios", () => {
  it("keeps nine distinct, valid scenarios ready for model regression checks", () => {
    expect(fixtures).toHaveLength(9);
    expect(new Set(fixtures.map((item) => item.id)).size).toBe(9);
    expect(new Set(fixtures.map((item) => item.scenario.template))).toEqual(
      new Set(["boundary", "friend", "relationship", "work"]),
    );
    for (const item of fixtures) {
      expect(scenarioSchema.safeParse(item.scenario).success, item.id).toBe(true);
      expect(item.opening.length, item.id).toBeGreaterThan(0);
      expect(item.opening.length, item.id).toBeLessThanOrEqual(2000);
    }
  });
});
