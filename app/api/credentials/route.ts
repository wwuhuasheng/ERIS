import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { removeSavedApiKey, saveApiKey, savedApiKeyExists } from "@/lib/saved-api-key";

export const runtime = "nodejs";

const credentialSchema = z.object({ apiKey: z.string().trim().min(10).max(300) });

async function verifiedUserId(request: Request): Promise<string | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) throw new Error("账号服务尚未配置。");
  const authorization = request.headers.get("authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!token) return null;
  const auth = createClient(url, publishableKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  const { data, error } = await auth.auth.getUser(token);
  return error || !data.user || data.user.is_anonymous ? null : data.user.id;
}

function reply(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

async function handle(request: Request, action: "read" | "save" | "delete") {
  try {
    const ownerId = await verifiedUserId(request);
    if (!ownerId) return reply({ error: "请先注册或登录。" }, 401);
    if (action === "read") return reply({ configured: await savedApiKeyExists(ownerId) });
    if (action === "delete") {
      await removeSavedApiKey(ownerId);
      return reply({ configured: false });
    }
    const body = await request.text();
    if (body.length > 1024) return reply({ error: "API Key 输入过长。" }, 413);
    const parsed = credentialSchema.parse(JSON.parse(body));
    await saveApiKey(ownerId, parsed.apiKey);
    return reply({ configured: true });
  } catch (cause) {
    if (cause instanceof ZodError || cause instanceof SyntaxError) return reply({ error: "请输入有效的 DeepSeek API Key。" }, 400);
    return reply({ error: cause instanceof Error && cause.message.includes("未配置") ? cause.message : "API Key 保存服务暂时不可用，请稍后重试。" }, 503);
  }
}

export async function GET(request: Request) { return handle(request, "read"); }
export async function PUT(request: Request) { return handle(request, "save"); }
export async function DELETE(request: Request) { return handle(request, "delete"); }
