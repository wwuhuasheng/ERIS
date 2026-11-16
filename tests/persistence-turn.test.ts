import { beforeEach, describe, expect, it, vi } from "vitest";
import { storeAssistantTurn } from "../lib/persistence";
import { initialState } from "../lib/state";

const mock = vi.hoisted(() => ({ getUser: vi.fn(), from: vi.fn() }));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ auth: { getUser: mock.getUser }, from: mock.from }),
}));

const message = { id: "de4aeed1-48ab-49f2-b84c-16f4e0b45bc0", role: "assistant" as const, content: "我会提前告诉你。" };

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
  mock.getUser.mockResolvedValue({ data: { user: { id: "test-user", is_anonymous: false } }, error: null });
  mock.from.mockReset();
});

describe("assistant turn persistence", () => {
  it("writes the message and state before reporting success", async () => {
    const calls: string[] = [];
    mock.from.mockImplementation((table: string) => {
      if (table === "messages") return { insert: async () => { calls.push("message"); return { error: null }; } };
      if (table === "scene_states") return { insert: async () => { calls.push("state"); return { error: null }; } };
      throw new Error("unexpected table");
    });
    await storeAssistantTurn("session-1", message, 1, initialState, "用户说出感受", false);
    expect(calls).toEqual(["message", "state"]);
  });

  it("removes the partial reply when state storage fails", async () => {
    const calls: string[] = [];
    const rollback = { error: null, eq: () => rollback };
    const missingState = { eq: () => missingState, maybeSingle: async () => ({ data: null, error: null }) };
    mock.from.mockImplementation((table: string) => {
      if (table === "messages") return {
        insert: async () => { calls.push("message"); return { error: null }; },
        delete: () => { calls.push("rollback"); return rollback; },
      };
      if (table === "scene_states") return {
        insert: async () => { calls.push("state_failed"); return { error: new Error("state write failed") }; },
        select: () => missingState,
      };
      throw new Error("unexpected table");
    });
    await expect(storeAssistantTurn("session-1", message, 1, initialState, "原因", false)).rejects.toThrow("state write failed");
    expect(calls).toEqual(["message", "state_failed", "rollback"]);
  });

  it("accepts a state row that was written before a transport error", async () => {
    const existing = { ...initialState, change_reason: "原因" };
    const found = { eq: () => found, maybeSingle: async () => ({ data: existing, error: null }) };
    mock.from.mockImplementation((table: string) => {
      if (table === "messages") return { insert: async () => ({ error: null }), delete: () => { throw new Error("unexpected rollback"); } };
      if (table === "scene_states") return {
        insert: async () => ({ error: new Error("network interrupted") }),
        select: () => found,
      };
      throw new Error("unexpected table");
    });
    await expect(storeAssistantTurn("session-1", message, 1, initialState, "原因", false)).resolves.toBeUndefined();
  });
});
