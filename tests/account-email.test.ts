import { describe, expect, it } from "vitest";
import { creatorAccountEmail, phoneAccountEmail, testAccountEmail } from "@/lib/account-email";

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

  it("keeps creator usernames separate from test and phone accounts", () => {
    expect(creatorAccountEmail(" Writer_01 ")).toBe("c-writer_01@accounts.eris.invalid");
    expect(creatorAccountEmail("20070502")).toBeNull();
    expect(creatorAccountEmail("../admin")).toBeNull();
  });
});
