import { afterEach, describe, expect, it, vi } from "vitest";
import { DELETE, GET, PUT } from "../app/api/credentials/route";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  exists: vi.fn(),
  save: vi.fn(),
  remove: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ auth: { getUser: mocks.getUser } }),
}));

vi.mock("@/lib/saved-api-key", () => ({
  savedApiKeyExists: mocks.exists,
  saveApiKey: mocks.save,
  removeSavedApiKey: mocks.remove,
}));

function request(method: string, token?: string, body?: string) {
  return new Request("http://localhost/api/credentials", {
    method,
    headers: token ? { Authorization: "Bearer " + token } : {},
    body,
  });
}

function configure() {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
  mocks.getUser.mockResolvedValue({ data: { user: { id: "user-123", is_anonymous: false } }, error: null });
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetAllMocks();
});

describe("account API Key endpoint", () => {
  it("rejects unauthenticated reads", async () => {
    configure();
    const response = await GET(request("GET"));
    expect(response.status).toBe(401);
    expect(mocks.exists).not.toHaveBeenCalled();
  });

  it("returns only a saved status, never the key", async () => {
    configure();
    mocks.exists.mockResolvedValue(true);
    const response = await GET(request("GET", "user-token"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ configured: true });
    expect(mocks.exists).toHaveBeenCalledWith("user-123");
  });

  it("saves a key only for the verified user", async () => {
    configure();
    mocks.save.mockResolvedValue(undefined);
    const secret = "sk-my-private-deepseek-key";
    const response = await PUT(request("PUT", "user-token", JSON.stringify({ apiKey: secret })));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ configured: true });
    expect(mocks.save).toHaveBeenCalledWith("user-123", secret);
  });

  it("removes only the verified user's key", async () => {
    configure();
    mocks.remove.mockResolvedValue(undefined);
    const response = await DELETE(request("DELETE", "user-token"));
    expect(response.status).toBe(200);
    expect(mocks.remove).toHaveBeenCalledWith("user-123");
  });
});
