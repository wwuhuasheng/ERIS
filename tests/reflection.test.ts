import { describe, expect, it } from "vitest";
import { buildReflection } from "../lib/reflection";

describe("optional reflection", () => {
  it("cites actual message positions and avoids reality claims", () => {
    const result = buildReflection([
      { id: "1", role: "user", content: "我真的很失望。" },
      { id: "2", role: "assistant", content: "我最近压力很大。", turningPoint: true },
    ]);
    expect(result.text).toContain("第 1 条消息");
    expect(result.text).toContain("第 2 条消息");
    expect(result.text).toContain("不说明现实中的对方一定会这样想");
    expect(result.coreExpression).toBe("我真的很失望。");
  });

  it("keeps the original unsaid words separate from spoken lines and cites turning reasons", () => {
    const result = buildReflection([
      { id: "1", role: "user", content: "我等了很久。" },
      { id: "2", role: "assistant", content: "我知道你在等。", turningPoint: true, reason: "用户明确说出了等待", state: { tension: 70, conflict: 60 } },
      { id: "3", role: "user", content: "我希望你提前说。" },
    ], "别让我最后一个知道");
    expect(result.coreExpression).toBe("别让我最后一个知道");
    expect(result.text).toContain("开始前，你想说的是");
    expect(result.text).toContain("我希望你提前说");
    expect(result.text).toContain("用户明确说出了等待");
  });
});
