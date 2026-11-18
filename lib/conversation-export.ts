import type { Scenario } from "./scenario";
import type { Message } from "./chat";
import { displayMessageText } from "./chat-media";

export function conversationText(scenario: Scenario, messages: Pick<Message, "role" | "content">[]): string {
  const lines = [
    `ERIS · ${scenario.title}`,
    "这是一段 AI 生成的情境模拟，不代表现实人物的真实想法。",
    "",
    "场景背景",
    scenario.background,
    "",
    "对话",
  ];
  for (const message of messages) {
    lines.push(`${message.role === "user" ? "你" : scenario.cast?.length ? "模拟人物" : scenario.otherRole}：${displayMessageText(message.content)}`);
    lines.push("");
  }
  return lines.join("\n").trimEnd() + "\n";
}
