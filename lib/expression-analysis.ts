import type { Message } from "./chat";
import { displayMessageText } from "./chat-media";

export type ExpressionObservation = {
  turns: number;
  repeatedLines: number;
  hesitationWords: number;
  hasFeeling: boolean;
  hasRequest: boolean;
  hasReason: boolean;
};

export function observeExpression(messages: Pick<Message, "role" | "content">[]): ExpressionObservation {
  const spoken = messages.filter((message) => message.role === "user").map((message) => displayMessageText(message.content).trim()).filter(Boolean);
  const normalized = spoken.map((line) => line.replace(/[\s，。！？,.!?；;]+/g, "").toLocaleLowerCase());
  const seen = new Set<string>();
  let repeatedLines = 0;
  for (const line of normalized) {
    if (line.length >= 4 && seen.has(line)) repeatedLines += 1;
    seen.add(line);
  }
  const text = spoken.join("\n");
  return {
    turns: spoken.length,
    repeatedLines,
    hesitationWords: (text.match(/嗯|呃|那个|就是说|怎么说呢/g) || []).length,
    hasFeeling: /我(觉得|感到|很|有点|难过|失望|担心|害怕|生气)/.test(text),
    hasRequest: /我(希望|想要|需要|不想|不能|不愿)|请你|能不能/.test(text),
    hasReason: /因为|原因|当时|那天|上次|这次|每次/.test(text),
  };
}
