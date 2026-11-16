import { describe, expect, it } from "vitest";
import { normalizePhone } from "@/lib/phone";

describe("normalizePhone", () => {
  it("normalizes mainland numbers to E.164", () => {
    expect(normalizePhone("138 0013 8000")).toBe("+8613800138000");
    expect(normalizePhone("86-13800138000")).toBe("+8613800138000");
  });

  it("accepts international E.164 numbers", () => {
    expect(normalizePhone("+1 (415) 555-0123")).toBe("+14155550123");
  });

  it("rejects account names and malformed phone numbers", () => {
    expect(normalizePhone("20070502")).toBeNull();
    expect(normalizePhone("12345678901")).toBeNull();
    expect(normalizePhone("+00000000000")).toBeNull();
  });
});
