import { createClient } from "@supabase/supabase-js";

const username = (process.env.ERIS_TEST_USERNAME || "").trim().toLowerCase();
const passphrase = process.env.ERIS_TEST_PASSPHRASE || "";
const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
if (!/^[a-z0-9_-]{1,64}$/.test(username) || passphrase.length < 8 || !url || !secret) {
  throw new Error("先在 .env.local 配置测试账号、暗号、Supabase URL 和服务端 secret key。");
}

const email = "t-" + username + "@accounts.eris.invalid";
const db = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
const { data, error } = await db.auth.admin.createUser({
  email,
  password: passphrase,
  email_confirm: true,
  app_metadata: { eris_test_account: true },
});
if (error) {
  if (error.code === "email_exists" || error.code === "email_address_exists") {
    throw new Error("测试登录用户已存在；未改动其暗号或权限。请在 Supabase Auth 中检查该用户。");
  }
  throw new Error("创建测试登录用户失败：" + error.message);
}
if (!data.user || data.user.app_metadata?.eris_test_account !== true) {
  throw new Error("测试登录用户创建结果缺少权限标记，请在 Supabase Auth 中检查。");
}
console.log("测试登录用户已建立在 Supabase Auth；用户 ID：" + data.user.id);
