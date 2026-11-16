"use client";

import { useState } from "react";
import type { Message } from "@/lib/chat";
import { observeExpression } from "@/lib/expression-analysis";

export function ExpressionPanel({ messages, typingPauses }: { messages: Pick<Message, "role" | "content">[]; typingPauses: number }) {
  const [criterion, setCriterion] = useState("");
  const [selfChecked, setSelfChecked] = useState(false);
  const observation = observeExpression(messages);
  return <section className="expression-panel">
    <h2>表达观察</h2>
    <p className="muted">只观察文字和本页输入节奏，不判断表达好坏。语音识别无法提供准确停顿信息。</p>
    <div className="expression-stats"><span>{observation.turns} 轮表达</span><span>重复整句 {observation.repeatedLines} 次</span><span>犹豫词 {observation.hesitationWords} 处</span><span>键盘输入停顿约 {typingPauses} 次</span></div>
    <p className="muted">文字中出现的线索：{[observation.hasFeeling && "感受", observation.hasReason && "具体事件或原因", observation.hasRequest && "请求或边界"].filter(Boolean).join("、") || "暂未识别到明确线索"}。这些规则只看字面，可能漏判。</p>
    <label className="field"><span>这次你想用什么标准看自己的表达？</span><input value={criterion} onChange={(event) => { setCriterion(event.target.value); setSelfChecked(false); }} maxLength={120} placeholder="例如：有没有清楚说出自己的边界" /></label>
    {criterion.trim() && <label className="self-check"><input type="checkbox" checked={selfChecked} onChange={(event) => setSelfChecked(event.target.checked)} />我认为这次做到了：{criterion.trim()}</label>}
    <p className="muted">自定标准与勾选仅在当前页面保留，不会自动评分或上传。</p>
  </section>;
}
