import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "../app/api/chat/route";
import { fixedScenario } from "../lib/scenario";
import { initialState } from "../lib/state";

const auth = vi.hoisted(() => ({ getUser: vi.fn() }));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ auth: { getUser: auth.getUser } }),
}));

function request(token?: string) {
  return new Request("http://localhost/api/chat", {
    method: "POST",
    headers: token ? { Authorization: "Bearer " + token } : {},
    body: "not-json",
  });
}

function testAccessRequest(token: string) {
  return new Request("http://localhost/api/chat", {
    method: "POST",
    headers: { Authorization: "Bearer " + token },
    body: JSON.stringify({
      scenario: fixedScenario,
      state: initialState,
      messages: [{ id: "8ad8ee7a-3c1a-4d52-a8bb-c455cbca1a22", role: "user", content: "你好" }],
      access: { kind: "test" },
    }),
  });
}

function configureAuth() {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
}

afterEach(() => {
  vi.unstubAllEnvs();
  auth.getUser.mockReset();
});

describe("chat route account boundary", () => {
  it("requires configured account service", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");
    const response = await POST(request());
    expect(response.status).toBe(503);
  });

  it("rejects requests without a login token", async () => {
    configureAuth();
    const response = await POST(request());
    expect(response.status).toBe(401);
    expect(auth.getUser).not.toHaveBeenCalled();
  });

  it("rejects an anonymous account", async () => {
    configureAuth();
    auth.getUser.mockResolvedValue({ data: { user: { id: "anonymous", is_anonymous: true } }, error: null });
    const response = await POST(request("anonymous-token"));
    expect(response.status).toBe(401);
  });

  it("accepts a registered account before validating the request body", async () => {
    configureAuth();
    auth.getUser.mockResolvedValue({ data: { user: { id: "registered", is_anonymous: false } }, error: null });
    const response = await POST(request("registered-token"));
    expect(response.status).toBe(400);
    expect(auth.getUser).toHaveBeenCalledWith("registered-token");
  });

  it("denies project-funded model access to a normal phone account", async () => {
    configureAuth();
    auth.getUser.mockResolvedValue({ data: { user: { id: "phone-user", is_anonymous: false, app_metadata: { eris_account_type: "phone_alias" }, user_metadata: { eris_test_account: true } } }, error: null });
    const response = await POST(testAccessRequest("phone-token"));
    expect(response.status).toBe(403);
  });

  it("accepts only a server-owned test role before checking model configuration", async () => {
    configureAuth();
    vi.stubEnv("DEEPSEEK_API_KEY", "");
    auth.getUser.mockResolvedValue({ data: { user: { id: "owner-test", is_anonymous: false, app_metadata: { eris_test_account: true } } }, error: null });
    const response = await POST(testAccessRequest("test-token"));
    expect(response.status).toBe(503);
  });
});
