import { createClient } from "@supabase/supabase-js";

const dailyUsage = new Map<string, number>();

function positiveLimit(raw: string | undefined, fallback: number): number {
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export async function consumeTestQuota(now = new Date()): Promise<boolean> {
  const limit = positiveLimit(process.env.ERIS_TEST_DAILY_LIMIT, 100);
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (url && secret) {
    const db = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await db.rpc("consume_test_quota", { p_limit: limit });
    if (error) throw new Error("quota_store_failed");
    return data === true;
  }
  if (process.env.NODE_ENV === "production") throw new Error("quota_not_configured");
  const day = now.toISOString().slice(0, 10);
  const used = dailyUsage.get(day) || 0;
  if (used >= limit) return false;
  dailyUsage.set(day, used + 1);
  for (const key of dailyUsage.keys()) if (key !== day) dailyUsage.delete(key);
  return true;
}
