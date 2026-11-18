import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { validCompactImage } from "@/lib/chat-media";
import { recognizeStickerTone } from "@/lib/sticker-tone";
import { readSavedApiKey } from "@/lib/saved-api-key";
import { consumeTestQuota } from "@/lib/rate-limit";

export const runtime = "nodejs";

function reply(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) return reply({ error: "账号服务尚未配置。" }, 503);
  const authorization = request.headers.get("authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!token) return reply({ error: "请先登录账号。" }, 401);
  try {
    const db = createClient(url, publishableKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
    const { data, error } = await db.auth.getUser(token);
    if (error || !data.user || data.user.is_anonymous) return reply({ error: "登录已失效，请重新登录。" }, 401);
    const raw = await request.text();
    if (raw.length > 5000) return reply({ error: "表情包图片过大。" }, 413);
    const body = JSON.parse(raw) as { image?: unknown };
    if (typeof body.image !== "string" || !validCompactImage(body.image)) return reply({ error: "请选择有效的表情包图片。" }, 400);
    const isTestAccount = data.user.app_metadata?.eris_test_account === true;
    const key = isTestAccount ? process.env.DEEPSEEK_API_KEY || "" : await readSavedApiKey(data.user.id) || "";
    if (!key) return reply({ error: isTestAccount ? "测试入口尚未配置 DeepSeek API。" : "请先保存自己的 DeepSeek API Key。" }, 409);
    if (isTestAccount && !(await consumeTestQuota())) return reply({ error: "今日测试额度已用完，仍可手动填写表情语气。" }, 429);
    return reply({ tone: await recognizeStickerTone(body.image, key) });
  } catch (cause) {
    if (cause instanceof SyntaxError) return reply({ error: "表情包请求格式不正确。" }, 400);
    console.error(JSON.stringify({ event: "sticker_tone_failed", code: cause instanceof Error ? cause.message.slice(0, 60) : "unknown" }));
    return reply({ error: "暂时无法识别表情语气，可以手动填写后发送。" }, 502);
  }
}
