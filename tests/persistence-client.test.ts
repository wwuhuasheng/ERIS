import { afterEach, describe, expect, it, vi } from "vitest";

const createClient = vi.hoisted(() => vi.fn(() => ({ auth: { onAuthStateChange: vi.fn() } })));
vi.mock("@supabase/supabase-js", () => ({ createClient }));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
  createClient.mockClear();
});

describe("browser Supabase client", () => {
  it("reuses one Auth client when Next reloads the module", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "publishable-key");
    vi.stubGlobal("window", {});
    const first = (await import("@/lib/persistence")).authClient();
    vi.resetModules();
    const second = (await import("@/lib/persistence")).authClient();
    expect(second).toBe(first);
    expect(createClient).toHaveBeenCalledTimes(1);
  });
});
