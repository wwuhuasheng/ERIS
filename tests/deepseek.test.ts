import { afterEach, describe, expect, it, vi } from "vitest";
import { generateReply } from "../lib/deepseek";
import { fixedScenario } from "../lib/scenario";
import { initialState } from "../lib/state";
import type { ChatRequest } from "../lib/chat";

const request: ChatRequest = {
  scenario: fixedScenario,
  state: initialState,
  messages: [{ id: "8ad8ee7a-3c1a-4d52-a8bb-c455cbca1a22", role: "user", content: "你又临时取消，我真的很失望。" }],
  access: { kind: "test", username: "tester", passphrase: "secret" },
};

const valid = JSON.stringify({
  reply: "我知道这已经不是第一次了，但我不是故意让你失望。",
  visible_emotion: "防御而疲惫",
  conflict_move: "defend",
  state_change: { tension: 2, openness: -1, trust: -2, conflict: 2, hurt: 1, expression_coverage: 4 },
  change_reason: "用户指出多次失约",
  turning_point_candidate: false,
  director_signal: "continue",
});

afterEach(() => vi.unstubAllGlobals());

describe("DeepSeek response boundary", () => {
  it("accepts a valid structured role response", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ output: [{ content: [{ type: "output_text", text: valid }] }] }) });
    vi.stubGlobal("fetch", fetchMock);
    const result = await generateReply(request, "key-not-logged", "deepseek-flash");
    expect(result.reply.conflict_move).toBe("defend");
    expect(result.repaired).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.deepseek.com/responses");
    expect(options.headers.Authorization).toBe("Bearer key-not-logged");
    const body = JSON.parse(options.body);
    expect(body.text.format.type).toBe("json_schema");
    expect(body.text.format.schema.required).toContain("reply");
    expect(body.text.format.schema.properties.state_change.required).toContain("tension");
    expect(body.instructions).not.toContain(fixedScenario.background);
    expect(body.instructions).toContain("自然对话准则");
    expect(body.instructions).toContain("不要在 reply 中透露");
    expect(body.instructions).toContain("不冒充某位现实人物");
    expect(body.input[0].content).toContain(fixedScenario.background);
    expect(body.input[0].content).not.toContain(fixedScenario.unsaidWords);
  });

  it("tries one format repair and surfaces an error instead of repeating a canned reply", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ output_text: "not-json" }) });
    vi.stubGlobal("fetch", fetchMock);
    await expect(generateReply(request, "key", "deepseek-flash")).rejects.toThrow("invalid_model_output");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("uses a valid repaired response if the first response has invalid JSON", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ output_text: "not-json" }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ output_text: valid }) });
    vi.stubGlobal("fetch", fetchMock);
    const result = await generateReply(request, "key", "deepseek-flash");
    expect(result.repaired).toBe(true);
    expect(result.reply.reply).toContain("不是故意");
  });

  it("does not pass through an incomplete provider response", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: "incomplete", output_text: valid }) });
    vi.stubGlobal("fetch", fetchMock);
    await expect(generateReply(request, "key", "deepseek-flash")).rejects.toThrow("incomplete_response");
  });
});
