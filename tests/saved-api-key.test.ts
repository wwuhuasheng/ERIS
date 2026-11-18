import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { decryptApiKey, encryptApiKey } from "../lib/saved-api-key";

beforeEach(() => {
  vi.stubEnv("ERIS_API_KEY_ENCRYPTION_KEY", Buffer.alloc(32, 7).toString("base64"));
});

afterEach(() => vi.unstubAllEnvs());

describe("saved DeepSeek API Key encryption", () => {
  it("round-trips a key without storing plaintext", () => {
    const secret = "sk-example-private-value";
    const encrypted = encryptApiKey(secret);
    expect(encrypted).toMatch(/^v1\./);
    expect(encrypted).not.toContain(secret);
    expect(decryptApiKey(encrypted)).toBe(secret);
    expect(encryptApiKey(secret)).not.toBe(encrypted);
  });

  it("rejects a changed ciphertext", () => {
    const encrypted = encryptApiKey("sk-example-private-value");
    const parts = encrypted.split(".");
    parts[3] = (parts[3].startsWith("A") ? "B" : "A") + parts[3].slice(1);
    expect(() => decryptApiKey(parts.join("."))).toThrow();
  });

  it("requires a 32-byte server encryption key", () => {
    vi.stubEnv("ERIS_API_KEY_ENCRYPTION_KEY", "");
    expect(() => encryptApiKey("sk-example-private-value")).toThrow("加密密钥");
  });
});
