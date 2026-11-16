/** Keep the UI friendly to mainland Chinese numbers while sending E.164 to Auth. */
export function normalizePhone(value: string): string | null {
  const compact = value.trim().replace(/[\s()\-]/g, "");
  if (/^1[3-9]\d{9}$/.test(compact)) return `+86${compact}`;
  if (/^86(1[3-9]\d{9})$/.test(compact)) return `+${compact}`;
  if (/^\+[1-9]\d{7,14}$/.test(compact)) return compact;
  return null;
}
