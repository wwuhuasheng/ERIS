import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "../app/api/auth/register/route";

const admin = vi.hoisted(() => ({ createUser: vi.fn() }));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ auth: { admin: { createUser: admin.createUser } } }),
}));

function request(phone: string, password = "correct-horse-password") {
  return new Request("http://localhost/api/auth/register", {
    method: "POST", body: JSON.stringify({ phone, password }),
  });
}

afterEach(() => {
  vi.unstubAllEnvs();
  admin.createUser.mockReset();
});

describe("phone-form registration", () => {
  it("requires the server secret and never creates an account without it", async () => {
    vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_SECRET_KEY", "");
    expect((await POST(request("13800138000"))).status).toBe(503);
    expect(admin.createUser).not.toHaveBeenCalled();
  });

  it("creates a password account without marking a real phone as verified", async () => {
    vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_SECRET_KEY", "server-secret");
    admin.createUser.mockResolvedValue({ data: { user: { id: "new-user" } }, error: null });
    const response = await POST(request("13800138001"));
    expect(response.status).toBe(201);
    expect(admin.createUser).toHaveBeenCalledWith({
      email: "p-8613800138001@accounts.eris.invalid",
      password: "correct-horse-password",
      email_confirm: true,
      user_metadata: { display_phone: "+8613800138001" },
      app_metadata: { eris_account_type: "phone_alias" },
    });
  });

  it("rejects an invalid phone before calling Auth", async () => {
    vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_SECRET_KEY", "server-secret");
    expect((await POST(request("20070502"))).status).toBe(400);
    expect(admin.createUser).not.toHaveBeenCalled();
  });

  it("does not overwrite an existing phone account", async () => {
    vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_SECRET_KEY", "server-secret");
    admin.createUser.mockResolvedValue({ data: { user: null }, error: { code: "email_exists" } });
    expect((await POST(request("13800138002"))).status).toBe(409);
  });
});

describe("creator registration", () => {
  it("creates a separate account with server-owned creator role", async () => {
    vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_SECRET_KEY", "server-secret");
    admin.createUser.mockResolvedValue({ data: { user: { id: "creator-user" } }, error: null });
    const response = await POST(new Request("http://localhost/api/auth/register", {
      method: "POST", body: JSON.stringify({ kind: "creator", username: "StoryMaker", password: "correct-horse-password" }),
    }));
    expect(response.status).toBe(201);
    expect(admin.createUser).toHaveBeenCalledWith({
      email: "c-storymaker@accounts.eris.invalid", password: "correct-horse-password", email_confirm: true,
      user_metadata: { creator_name: "storymaker" }, app_metadata: { eris_account_type: "creator" },
    });
  });

  it("does not allow a test username to impersonate the creator namespace", async () => {
    vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_SECRET_KEY", "server-secret");
    const response = await POST(new Request("http://localhost/api/auth/register", {
      method: "POST", body: JSON.stringify({ kind: "creator", username: "20070502", password: "correct-horse-password" }),
    }));
    expect(response.status).toBe(400);
    expect(admin.createUser).not.toHaveBeenCalled();
  });
});
