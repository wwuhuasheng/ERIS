import type { Message } from "./chat";

type ReflectableMessage = Message & { turningPoint?: boolean; reason?: string; state?: { tension: number; conflict: number } };

export type Reflection = {
  coreExpression: string;
  peakMoment: string;
  text: string;
};

function excerpt(value: string): string {
  return value.length > 100 ? `${value.slice(0, 100)}…` : value;
}

export function buildReflection(messages: ReflectableMessage[], originalWords = ""): Reflection {
  const lastUserIndex = messages.findLastIndex((message) => message.role === "user");
  const pointIndex = messages.findIndex((message) => message.role === "assistant" && message.turningPoint);
  const lastAssistantIndex = messages.findLastIndex((message) => message.role === "assistant");
  const highestTensionIndex = messages.reduce((best, message, index) =>
    message.role === "assistant" && message.state && (best < 0 || message.state.tension > (messages[best].state?.tension ?? -1)) ? index : best, -1);
  const counterpartIndex = highestTensionIndex >= 0 ? highestTensionIndex : pointIndex >= 0 ? pointIndex : lastAssistantIndex;
  const coreExpression = originalWords.trim() || (lastUserIndex >= 0 ? messages[lastUserIndex].content : "");
  const peakMoment = counterpartIndex >= 0 ? messages[counterpartIndex].content : "";
  const parts = ["这是一段 AI 生成的对话，不说明现实中的对方一定会这样想或这样回应。"];
  if (originalWords.trim()) parts.push("开始前，你想说的是：“" + excerpt(coreExpression) + "”");
  if (lastUserIndex >= 0) parts.push(`在第 ${lastUserIndex + 1} 条消息里，你说了：“${excerpt(messages[lastUserIndex].content)}”`);
  if (counterpartIndex >= 0) parts.push(`在第 ${counterpartIndex + 1} 条消息里，模拟角色回应：“${excerpt(peakMoment)}”`);
  const points = messages.map((message, index) => ({ message, index })).filter(({ message }) => message.role === "assistant" && message.turningPoint).slice(0, 3);
  for (const { message, index } of points) {
    parts.push("第 " + (index + 1) + " 条消息是一个候选转折点：“" + excerpt(message.content) + "”" +
      (message.reason ? "。模型给出的变化原因：" + excerpt(message.reason) : ""));
  }
  parts.push("如果你愿意，可以想一想：这次最想被听见的部分是什么？无需现在给出答案。");
  return { coreExpression, peakMoment, text: parts.join("\n") };
}
