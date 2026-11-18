import { describe, expect, it } from "vitest";
import { conversationText } from "../lib/conversation-export";
import { fixedScenario } from "../lib/scenario";

describe("conversation export", () => {
  it("exports spoken lines without hidden notes or API credentials", () => {
    const text = conversationText(fixedScenario, [{ role: "user", content: "我想说清楚。" }, { role: "assistant", content: "你说吧。" }]);
    expect(text).toContain("我想说清楚。");
    expect(text).toContain("好友林澈：你说吧。");
    expect(text).not.toContain(fixedScenario.userConcern);
    expect(text).not.toContain(fixedScenario.unsaidWords);
  });
});
