import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { z } from "zod";
import { phoneAccountEmail } from "@/lib/account-email";
import { normalizePhone } from "@/lib/phone";

export const runtime = "nodejs";

const inputSchema = z.object({
  phone: z.string().max(40),
  password: z.string().min(8).max(72),
});

const attempts = new Map<string, { count: number; until: number }>();

function reply(body: Record<string, unknown>, status: number) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function limited(key: string): boolean {
  const now = Date.now();
  const current = attempts.get(key);
  if (!current || current.until <= now) {
    attempts.set(key, { count: 1, until: now + 60 * 60 * 1000 });
    return false;
  }
  current.count++;
  return current.count > 5;
}

export async function POST(request: Request) {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) return reply({ error: "账号注册服务尚未配置。" }, 503);

  let input: z.infer<typeof inputSchema>;
  try {
    const raw = await request.text();
    if (raw.length > 512) return reply({ error: "输入内容过长。" }, 413);
    input = inputSchema.parse(JSON.parse(raw));
  } catch {
    return reply({ error: "请填写手机号和至少 8 位密码。" }, 400);
  }

  const phone = normalizePhone(input.phone);
  const email = phoneAccountEmail(input.phone);
  if (!phone || !email) return reply({ error: "手机号格式不正确。" }, 400);
  if (limited(email)) return reply({ error: "尝试次数过多，请稍后再试。" }, 429);

  try {
    const db = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
    const { error } = await db.auth.admin.createUser({
      email,
      password: input.password,
      email_confirm: true,
      user_metadata: { display_phone: phone },
      app_metadata: { eris_account_type: "phone_alias" },
    });
    if (error) {
      if (error.code === "email_exists" || error.code === "email_address_exists") return reply({ error: "此手机号已注册，请返回登录并检查密码。" }, 409);
      return reply({ error: "暂时无法创建账号，请稍后再试。" }, 503);
    }
    return reply({ email }, 201);
  } catch {
    return reply({ error: "账号注册服务暂时不可用。" }, 503);
  }
}
