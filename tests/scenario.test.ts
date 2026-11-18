import { describe, expect, it } from "vitest";
import { blankScenario, decodeScenePosition, encodeScenePosition, fixedScenario, scenarioHints, scenarioSchema, toPerspectiveScenario } from "../lib/scenario";
import { accessForAccount, chatRequestSchema, modelReplySchema } from "../lib/chat";
import { initialState } from "../lib/state";

describe("runtime boundaries", () => {
  it("round trips a multi-character cast through the stored position field", () => {
    const scene = { ...fixedScenario, otherRole: "导师、同学", otherPosition: "导师：关注进度；同学：担心分工", cast: [{ name: "导师", position: "关注研究进度" }, { name: "同学", position: "担心任务分工" }] };
    expect(scenarioSchema.safeParse(scene).success).toBe(true);
    expect(decodeScenePosition(encodeScenePosition(scene))).toEqual({ position: scene.otherPosition, cast: scene.cast });
    expect(scenarioSchema.safeParse({ ...scene, cast: [scene.cast[0], scene.cast[0]] }).success).toBe(false);
  });
  it("stores personal memory separately and clears it for role swap", () => {
    const scene = { ...fixedScenario, memoryNote: "我们去年曾为同一件事争论。", memoryEnabled: true };
    expect(decodeScenePosition(encodeScenePosition(scene))).toMatchObject({ memoryNote: scene.memoryNote, memoryEnabled: true });
    expect(toPerspectiveScenario(scene).memoryNote).toBe("");
    expect(toPerspectiveScenario(scene).memoryEnabled).toBe(false);
  });
  it("keeps compact avatars in a saved scene and swaps them with roles", () => {
    const avatar = "data:image/webp;base64,UklGRg==";
    const scene = { ...fixedScenario, userAvatar: avatar, otherAvatar: avatar };
    expect(scenarioSchema.safeParse(scene).success).toBe(true);
    expect(decodeScenePosition(encodeScenePosition(scene))).toMatchObject({ userAvatar: avatar, otherAvatar: avatar });
    expect(toPerspectiveScenario(scene).userAvatar).toBe(avatar);
  });
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
  it("always uses the server funded API for the fixed test account", () => {
    expect(accessForAccount(true, "deepseek-v4-pro")).toEqual({ kind: "test" });
    expect(accessForAccount(false, "deepseek-flash")).toEqual({ kind: "own_saved", model: "deepseek-flash" });
  });
});
