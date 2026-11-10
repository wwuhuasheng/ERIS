import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "../app/api/chat/route";

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
});
