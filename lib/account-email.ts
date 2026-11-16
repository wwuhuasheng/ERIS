import { normalizePhone } from "./phone";

// These are internal Auth identifiers, not deliverable email addresses.
const domain = "accounts.eris.invalid";

export function phoneAccountEmail(value: string): string | null {
  const phone = normalizePhone(value);
  return phone ? "p-" + phone.slice(1) + "@" + domain : null;
}

export function testAccountEmail(value: string): string | null {
  const username = value.trim().toLowerCase();
  return /^[a-z0-9_-]{1,64}$/.test(username) ? "t-" + username + "@" + domain : null;
}
