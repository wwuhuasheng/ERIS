import { describe, expect, it } from "vitest";
import { blankScenario, fixedScenario, scenarioHints, scenarioSchema, toPerspectiveScenario } from "../lib/scenario";
import { chatRequestSchema, modelReplySchema } from "../lib/chat";
import { initialState } from "../lib/state";

describe("runtime boundaries", () => {
  it("accepts the fixed scenario", () => {
    expect(scenarioSchema.safeParse(fixedScenario).success).toBe(true);
  });
  it("starts custom scenes empty and varies guidance by template", () => {
    const friend = blankScenario("friend");
    const work = blankScenario("work");
    expect(friend.title).toBe("");
    expect(friend.background).toBe("");
    expect(work.template).toBe("work");
    expect(scenarioHints.friend.background).not.toBe(scenarioHints.work.background);
    expect(scenarioSchema.safeParse(work).success).toBe(false);
  });
  it("swaps roles without carrying hidden user notes", () => {
    const swapped = toPerspectiveScenario(fixedScenario);
    expect(swapped.userRole).toBe(fixedScenario.otherRole);
    expect(swapped.otherRole).toBe(fixedScenario.userRole);
    expect(swapped.unsaidWords).toBe("");
    expect(swapped.userConcern).toBe("");
    expect(scenarioSchema.safeParse(swapped).success).toBe(true);
  });
  it("rejects an overlong or empty scene", () => {
    expect(scenarioSchema.safeParse({ ...fixedScenario, background: "x" }).success).toBe(false);
    expect(scenarioSchema.safeParse({ ...fixedScenario, excludedTopics: "x".repeat(501) }).success).toBe(false);
  });
  it("rejects unknown access modes and malformed model replies", () => {
    expect(chatRequestSchema.safeParse({ scenario: fixedScenario, state: initialState, messages: [{ id: crypto.randomUUID(), role: "user", content: "你好" }], access: { kind: "admin", apiKey: "x" } }).success).toBe(false);
    expect(modelReplySchema.safeParse({ reply: "好", state_change: { tension: 9999 } }).success).toBe(false);
  });
});
