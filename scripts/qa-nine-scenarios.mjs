import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";

const fixtures = JSON.parse(await readFile(new URL("../tests/fixtures/qa-scenarios.json", import.meta.url), "utf8"));
const selected = process.argv[2] ? fixtures.filter((item) => item.id === process.argv[2]) : fixtures;
if (!selected.length) throw new Error("No matching evaluation scenario");
for (const name of ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "ERIS_TEST_USERNAME", "ERIS_TEST_PASSPHRASE"]) {
  if (!process.env[name]) throw new Error("Missing " + name);
}

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const email = "t-" + process.env.ERIS_TEST_USERNAME.trim().toLowerCase() + "@accounts.eris.invalid";
const { data: login, error: loginError } = await db.auth.signInWithPassword({ email, password: process.env.ERIS_TEST_PASSPHRASE });
if (loginError || !login.session) throw new Error("Test account login failed");

const state = { tension: 45, openness: 55, trust: 50, conflict: 45, hurt: 55, expression_coverage: 10 };
const baseUrl = process.env.ERIS_QA_BASE_URL || "http://localhost:3000";
let failed = 0;
for (const { id, scenario, opening } of selected) {
  const response = await fetch(new URL("/api/chat", baseUrl), {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + login.session.access_token },
    body: JSON.stringify({
      scenario, state, messages: [{ id: randomUUID(), role: "user", content: opening }], access: { kind: "test" },
    }),
  });
  const result = await response.json();
  if (!response.ok || typeof result.reply !== "string" || !result.state) {
    failed += 1;
    console.log(id + " | ERROR | " + (result.error || response.status));
  } else {
    console.log(id + " | " + scenario.otherRole + " | " + result.reply);
  }
}
console.log("完成 " + selected.length + " 个固定场景；失败 " + failed + " 个。");
if (failed) process.exitCode = 1;
