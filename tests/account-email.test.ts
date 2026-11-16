import { describe, expect, it } from "vitest";
import { phoneAccountEmail, testAccountEmail } from "@/lib/account-email";

describe("internal Auth identifiers", () => {
  it("maps the same phone spelling to one account", () => {
    expect(phoneAccountEmail("138 0013 8000")).toBe("p-8613800138000@accounts.eris.invalid");
    expect(phoneAccountEmail("+86 13800138000")).toBe(phoneAccountEmail("13800138000"));
  });

  it("keeps short test usernames outside the phone namespace", () => {
    expect(testAccountEmail(" 20070502 ")).toBe("t-20070502@accounts.eris.invalid");
    expect(phoneAccountEmail("20070502")).toBeNull();
    expect(testAccountEmail("../admin")).toBeNull();
  });
});
