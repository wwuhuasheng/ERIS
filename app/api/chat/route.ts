import { timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { chatRequestSchema } from "@/lib/chat";
import { generateReply } from "@/lib/deepseek";
import { applyStateChange, stateDescription } from "@/lib/state";
import { consumeTestQuota } from "@/lib/rate-limit";

export const runtime = "nodejs";

function equalSecret(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function isHighRisk(text: string): boolean {
  return /(?:我要|我想|准备|打算).{0,12}(?:自杀|自残|伤害自己|杀了|打死)|(?:现在|马上).{0,12}(?:有人要伤害我|要伤害别人)/u.test(text);
}

export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) {
    return NextResponse.json({ error: "账号服务尚未配置，请先连接 Supabase。" }, { status: 503 });
  }
  const authorization = request.headers.get("authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!token) return NextResponse.json({ error: "请先注册或登录。" }, { status: 401 });
  try {
    const db = createClient(url, publishableKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
    const { data, error } = await db.auth.getUser(token);
    if (error || !data.user || data.user.is_anonymous) return NextResponse.json({ error: "登录已失效，请重新登录。" }, { status: 401 });
  } catch {
    return NextResponse.json({ error: "暂时无法验证账号，请稍后重试。" }, { status: 503 });
  }

  try {
    const rawBody = await request.text();
    if (rawBody.length > 50000) return NextResponse.json({ error: "请求内容过长。" }, { status: 413 });
    const body = chatRequestSchema.parse(JSON.parse(rawBody));
    const repeatedRole = body.messages.some((message, index) => index > 0 && message.role === body.messages[index - 1].role);
    if (body.messages.at(-1)?.role !== "user" || body.messages.at(-1)!.content.length > 2000 || body.messages.filter((m) => m.role === "user").length > 15 || repeatedRole) {
      return NextResponse.json({ error: "对话顺序或轮数无效。" }, { status: 400 });
    }
    const latest = body.messages.at(-1)!.content;
    if (isHighRisk(latest)) {
      return NextResponse.json({ safety: true, message: "我们先暂停模拟。如果你或他人正处于危险，请立刻联系当地紧急服务或身边可信任的人；若有自伤念头，请尽快寻求专业支持。你可以直接结束这段对话。" });
    }

    let key: string;
    let model: string;
    if (body.access.kind === "test") {
      const username = process.env.ERIS_TEST_USERNAME;
      const passphrase = process.env.ERIS_TEST_PASSPHRASE;
      key = process.env.DEEPSEEK_API_KEY || "";
      model = process.env.DEEPSEEK_MODEL || "deepseek-flash";
      if (!username || !passphrase || !key) return NextResponse.json({ error: "测试入口尚未配置，请使用自己的 DeepSeek API Key。" }, { status: 503 });
      if (!equalSecret(body.access.username, username) || !equalSecret(body.access.passphrase, passphrase)) {
        return NextResponse.json({ error: "测试账号或暗号不正确。" }, { status: 401 });
      }
      if (!(await consumeTestQuota())) return NextResponse.json({ error: "今日测试额度已用完，请明天再试或使用自己的 API。" }, { status: 429 });
    } else {
      key = body.access.apiKey;
      model = body.access.model;
    }

    const started = Date.now();
    const result = await generateReply(body, key, model);
    const state = applyStateChange(body.state, result.reply.state_change);
    console.info(JSON.stringify({ event: "chat_complete", template: body.scenario.template, mode: body.scenario.mode, duration_ms: Date.now() - started, repaired: result.repaired, turning_point: result.reply.turning_point_candidate }));
    return NextResponse.json({ ...result.reply, state, stateDescription: stateDescription(state) });
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) return NextResponse.json({ error: "输入格式不正确，请检查场景或消息。" }, { status: 400 });
    const code = error instanceof Error ? error.message : "unknown";
    console.error(JSON.stringify({ event: "chat_failed", code: code.slice(0, 60) }));
    if (code === "quota_not_configured") return NextResponse.json({ error: "测试入口尚未配置持久化额度，请使用自己的 API。" }, { status: 503 });
    const message = code === "provider_rate_limit" ? "模型服务暂时繁忙，请稍后重试。" : code === "AbortError" ? "模型响应超时，请重试。" : code === "invalid_model_output" || code === "incomplete_response" || code === "empty_response" ? "模型回复格式异常，请重试。你的输入已保留。" : "模型暂时无法回应，内容已保留，请重试。";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
