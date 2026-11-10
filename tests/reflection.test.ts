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
});
