import { afterEach, describe, expect, it, vi } from "vitest";
import { generateReply } from "../lib/deepseek";
import { fixedScenario, toPerspectiveScenario } from "../lib/scenario";
import { initialState } from "../lib/state";
import type { ChatRequest } from "../lib/chat";

const request: ChatRequest = {
  scenario: fixedScenario,
  state: initialState,
  messages: [{ id: "8ad8ee7a-3c1a-4d52-a8bb-c455cbca1a22", role: "user", content: "你又临时取消，我真的很失望。" }],
  access: { kind: "test" },
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
const perspectivePass = JSON.stringify({ speaker: "character" });
const perspectiveFail = JSON.stringify({ speaker: "user" });

afterEach(() => vi.unstubAllGlobals());

describe("DeepSeek response boundary", () => {
  it("requires named lines from a multi-character cast", async () => {
    const multi = { ...request, scenario: { ...fixedScenario, otherRole: "导师、同学", cast: [{ name: "导师", position: "关注进度" }, { name: "同学", position: "担心分工" }] } };
    const invalid = JSON.stringify({ ...JSON.parse(valid), reply: "我觉得可以再讨论。" });
    const named = JSON.stringify({ ...JSON.parse(valid), reply: "导师：我想听具体进展。\n同学：我也想谈谈分工。" });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ output_text: invalid }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ output_text: named }) });
    vi.stubGlobal("fetch", fetchMock);
    const result = await generateReply(multi, "key", "deepseek-flash");
    expect(result.reply.reply).toContain("导师：");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).input[0].content).toContain('"cast"');
  });
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
    expect(body.instructions).toContain("characterRole 就是你");
    expect(body.instructions).toContain("保持当前对话节奏");
    expect(body.input[0].content).toContain(fixedScenario.background);
    expect(body.input[0].content).not.toContain("累积委屈");
    expect(body.input[0].content).not.toContain("觉得自己的困难没有被看见");
    expect(body.instructions).not.toContain("今晚真的走不开");
    expect(body.input[0].content).toContain('"backgroundNarrator":"userRole"');
    expect(body.input[0].content).not.toContain(fixedScenario.unsaidWords);
    expect(JSON.parse(body.input[1].content).dialogue[0]).toEqual({ speaker: "userRole", text: "你又临时取消，我真的很失望。" });
    expect(JSON.parse(body.input[1].content).nextSpeaker).toBe("characterRole");
  });

  it("honors a user-selected gradual ending without forcing reconciliation", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ output_text: valid }) });
    vi.stubGlobal("fetch", fetchMock);
    await generateReply({ ...request, pace: "closing" }, "key", "deepseek-flash");
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.instructions).toContain("用户选择逐渐收尾");
    expect(body.instructions).toContain("不要突然和解");
  });
  it("gives conflict continuation its own behavior instead of replaying the opening", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ output_text: valid }) });
    vi.stubGlobal("fetch", fetchMock);
    await generateReply({ ...request, scenario: { ...fixedScenario, mode: "continue" } }, "key", "deepseek-flash");
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.instructions).toContain("从中断处继续");
    expect(body.instructions).toContain("不重演开场");
  });
  it("only shares explicitly enabled personal memory with the simulated character", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ output_text: valid }) });
    vi.stubGlobal("fetch", fetchMock);
    const scenario = { ...fixedScenario, memoryNote: "去年曾为这件事争论", memoryEnabled: false };
    await generateReply({ ...request, scenario }, "key", "deepseek-flash");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).input[0].content).not.toContain(scenario.memoryNote);
    await generateReply({ ...request, scenario: { ...scenario, memoryEnabled: true } }, "key", "deepseek-flash");
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).input[0].content).toContain(scenario.memoryNote);
  });

  it("anchors the original narrator when the user swaps roles", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ output_text: valid }) });
    vi.stubGlobal("fetch", fetchMock);
    await generateReply({ ...request, scenario: toPerspectiveScenario(fixedScenario) }, "key", "deepseek-flash");
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.input[0].content).toContain('"backgroundNarrator":"characterRole"');
    expect(body.instructions).toContain("不要自动把背景里的“我”认作你");
  });

  it("retries malformed output and surfaces an error instead of a canned reply", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ output_text: "not-json" }) });
    vi.stubGlobal("fetch", fetchMock);
    await expect(generateReply(request, "key", "deepseek-flash")).rejects.toThrow("invalid_model_output");
    expect(fetchMock).toHaveBeenCalledTimes(3);
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

  it("regenerates after the format repair also fails", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ output_text: "not-json" }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ output_text: "still-not-json" }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ output_text: valid }) });
    vi.stubGlobal("fetch", fetchMock);
    const result = await generateReply(request, "key", "deepseek-flash");
    expect(result.reply.reply).toContain("不是故意");
    expect(result.repaired).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("does not pass through an incomplete provider response", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: "incomplete", output_text: valid }) });
    vi.stubGlobal("fetch", fetchMock);
    await expect(generateReply(request, "key", "deepseek-flash")).rejects.toThrow("incomplete_response");
  });

  it("retries a repeated character line and returns a new reply", async () => {
    const prior = "我知道这已经不是第一次了，但我不是故意让你失望。";
    const withHistory: ChatRequest = {
      ...request,
      messages: [
        { id: crypto.randomUUID(), role: "user", content: "你为什么又临时取消？" },
        { id: crypto.randomUUID(), role: "assistant", content: prior },
        { id: crypto.randomUUID(), role: "user", content: "那你下次会提前告诉我吗？" },
      ],
    };
    const fresh = JSON.stringify({ ...JSON.parse(valid), reply: "下次如果我赶不上，我会当天上午告诉你。" });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ output_text: valid }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ output_text: fresh }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ output_text: perspectivePass }) });
    vi.stubGlobal("fetch", fetchMock);
    const result = await generateReply(withHistory, "key", "deepseek-flash");
    expect(result.reply.reply).toContain("当天上午");
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).instructions).toContain("重复了前文台词");
    expect(JSON.parse(JSON.parse(fetchMock.mock.calls[0][1].body).input[1].content).dialogue[1].speaker).toBe("characterRole");
  });

  it("moves past a repeated generic excuse without inventing a new event", async () => {
    const withHistory: ChatRequest = {
      ...request,
      messages: [
        { id: crypto.randomUUID(), role: "user", content: "你为什么又改约？" },
        { id: crypto.randomUUID(), role: "assistant", content: "我最近很忙，真的走不开。" },
        { id: crypto.randomUUID(), role: "user", content: "你能不能早点告诉我？" },
      ],
    };
    const generic = JSON.stringify({ ...JSON.parse(valid), reply: "我最近确实很忙，也不是故意的。" });
    const specific = JSON.stringify({ ...JSON.parse(valid), reply: "我应该在知道要改约时就告诉你，不该让你等到最后。" });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ output_text: generic }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ output_text: specific }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ output_text: perspectivePass }) });
    vi.stubGlobal("fetch", fetchMock);
    const result = await generateReply(withHistory, "key", "deepseek-flash");
    expect(result.reply.reply).toContain("告诉你");
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).instructions).toContain("旧理由");
  });

  it("rewrites a reply that speaks from the user's side", async () => {
    const withHistory: ChatRequest = {
      ...request,
      messages: [
        { id: crypto.randomUUID(), role: "user", content: "你又取消了。" },
        { id: crypto.randomUUID(), role: "assistant", content: "家里突然有事。" },
        { id: crypto.randomUUID(), role: "user", content: "能提前告诉我吗？" },
      ],
    };
    const wrong = JSON.stringify({ ...JSON.parse(valid), reply: "你临时取消，我一直在等你。" });
    const corrected = JSON.stringify({ ...JSON.parse(valid), reply: "我会尽量早点告诉你，今天确实拖到最后了。" });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ output_text: wrong }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ output_text: perspectiveFail }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ output_text: corrected }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ output_text: perspectivePass }) });
    vi.stubGlobal("fetch", fetchMock);
    const result = await generateReply(withHistory, "key", "deepseek-flash");
    expect(result.reply.reply).toContain("我会尽量早点告诉你");
    expect(result.perspectiveRepaired).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).text.format.name).toBe("eris_perspective_check");
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).model).toBe("deepseek-v4-pro");
  });

  it("keeps the user's input when a perspective rewrite still fails", async () => {
    const withHistory: ChatRequest = {
      ...request,
      messages: [
        { id: crypto.randomUUID(), role: "user", content: "你又取消了。" },
        { id: crypto.randomUUID(), role: "assistant", content: "家里突然有事。" },
        { id: crypto.randomUUID(), role: "user", content: "能提前告诉我吗？" },
      ],
    };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ output_text: valid }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ output_text: perspectiveFail }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ output_text: valid }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ output_text: perspectiveFail }) });
    vi.stubGlobal("fetch", fetchMock);
    await expect(generateReply(withHistory, "key", "deepseek-flash")).rejects.toThrow("perspective_mismatch");
  });

  it("reports an error when the retry still repeats", async () => {
    const withHistory: ChatRequest = {
      ...request,
      messages: [
        { id: crypto.randomUUID(), role: "assistant", content: JSON.parse(valid).reply },
        { id: crypto.randomUUID(), role: "user", content: "你会怎么做？" },
      ],
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ output_text: valid }) }));
    await expect(generateReply(withHistory, "key", "deepseek-flash")).rejects.toThrow("repetitive_model_output");
  });
});
