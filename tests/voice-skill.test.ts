import { describe, expect, it } from "vitest";
import { fixedScenario, type Scenario } from "../lib/scenario";
import { naturalVoiceSkill } from "../lib/voice-skill";

describe("natural voice prompt module", () => {
  it("keeps conversational guidance and safety boundaries together", () => {
    const text = naturalVoiceSkill(fixedScenario);
    expect(text).toContain("先接住用户刚说的具体内容");
    expect(text).toContain("不要列点、写总结");
    expect(text).toContain("不冒充某位现实人物");
    expect(text).toContain("不诱导用户依赖");
  });

  it.each([
    ["friend", "相识已久的朋友"],
    ["relationship", "亲密关系里的当事人"],
    ["boundary", "人情牵扯"],
    ["work", "真实的同事或上级"],
  ] as const)("uses a specific voice for %s", (template, cue) => {
    const scenario: Scenario = { ...fixedScenario, template };
    expect(naturalVoiceSkill(scenario)).toContain(cue);
  });
});
