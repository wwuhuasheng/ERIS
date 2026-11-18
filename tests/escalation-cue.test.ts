import { describe, expect, it } from "vitest";
import { escalationCue, extremeLanguage } from "../lib/escalation-cue";
import { initialState } from "../lib/state";

describe("conversation escalation cue", () => {
  it("stays quiet for ordinary disagreement", () => expect(escalationCue("我想把这件事说清楚。", initialState)).toBeNull());
  it("offers a pause when conflict or words are heated", () => {
    expect(escalationCue("你凭什么这样说！！！", initialState)).toContain("降低强度");
    expect(escalationCue("好吧", { ...initialState, tension: 80 })).toContain("先缓一口气");
  });
  it("gives a firmer stop for explicit threats", () => {
    expect(escalationCue("我要打死你", initialState)).toContain("先停一下");
    expect(extremeLanguage("我要打死你")).toBe(true);
  });
});
