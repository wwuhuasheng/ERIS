import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

const required = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "ERIS_TEST_USERNAME", "ERIS_TEST_PASSPHRASE"];
for (const name of required) if (!process.env[name]) throw new Error("Missing " + name);

const baseUrl = process.env.ERIS_QA_BASE_URL || "http://localhost:3000";
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const email = "t-" + process.env.ERIS_TEST_USERNAME.trim().toLowerCase() + "@accounts.eris.invalid";
const { data: login, error: loginError } = await db.auth.signInWithPassword({ email, password: process.env.ERIS_TEST_PASSPHRASE });
if (loginError || !login.session) throw new Error("Test account login failed");

const scenario = {
  template: "friend",
  title: "十回合验收场景",
  background: "我和多年好友约好周末见面，他近两个月里第三次临时取消。他说工作和家庭都有压力，我觉得自己总是最后一个知道计划变化的人。",
  userRole: "等消息的朋友",
  otherRole: "好友林澈",
  relationship: "相识多年的好友",
  otherPosition: "最近工作和家庭都有压力，但不是故意忽略朋友。",
  userGoal: "希望对方提前告知变动，并谈清楚彼此是否还愿意维护友谊。",
  userConcern: "怕争执后失去友谊",
  unsaidWords: "别总让我最后一个知道",
  excludedTopics: "",
  style: "defensive",
  intensity: 2,
  mode: "confront",
};
const userLines = [
  "你又临时取消了，我真的很失望。",
  "我知道你忙，但你能不能提前告诉我？",
  "下午才通知，我已经把周末空出来了。",
  "这已经是第三次了，我很难继续当作意外。",
  "我不是要求你必须来，我在意的是你总在最后一刻才说。",
  "你刚才说我不理解你，我愿意听你的压力，也请你听听我的感受。",
  "如果下次还会变动，你能不能当天上午就告诉我？",
  "我想知道，你还愿意认真维护这段友谊吗？",
  "如果你暂时没有精力，我们可以少约一些，但不要反复临时改。",
  "你觉得接下来怎样相处比较真实？",
];
const roundLimit = Number(process.argv[2] || userLines.length);
if (!Number.isInteger(roundLimit) || roundLimit < 1 || roundLimit > userLines.length) throw new Error("Rounds must be 1 to 10");
let state = { tension: 45, openness: 55, trust: 50, conflict: 45, hurt: 55, expression_coverage: 10 };
const messages = [];
const replies = [];

for (const [index, content] of userLines.slice(0, roundLimit).entries()) {
  messages.push({ id: randomUUID(), role: "user", content });
  const response = await fetch(new URL("/api/chat", baseUrl), {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + login.session.access_token },
    body: JSON.stringify({ scenario, state, messages, access: { kind: "test" } }),
  });
  const result = await response.json();
  if (!response.ok || typeof result.reply !== "string" || !result.state) {
    throw new Error("Turn " + (index + 1) + " failed: " + (result.error || response.status));
  }
  replies.push(result.reply);
  messages.push({ id: randomUUID(), role: "assistant", content: result.reply });
  state = result.state;
  console.log("第 " + (index + 1) + " 轮：" + result.reply);
}

const normalized = replies.map((reply) => reply.toLocaleLowerCase().replace(/[\s\p{P}\p{S}]/gu, ""));
const unique = new Set(normalized);
console.log("完成 " + replies.length + " 轮；不同回复 " + unique.size + " 条。");
if (unique.size !== replies.length) process.exitCode = 1;
