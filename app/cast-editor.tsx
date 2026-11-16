"use client";

import type { Scenario } from "@/lib/scenario";

export function CastEditor({ scenario, onChange }: { scenario: Scenario; onChange: (scenario: Scenario) => void }) {
  function changeCast(cast: NonNullable<Scenario["cast"]>) {
    onChange({ ...scenario, cast, otherRole: cast.map((member) => member.name).join("、"), otherPosition: cast.map((member) => `${member.name}：${member.position}`).join("；") });
  }

  return <div className="cast-editor">
    <label className="field"><span>对话人物</span><select value={scenario.cast?.length ? "multiple" : "single"} onChange={(event) => event.target.value === "single" ? onChange({ ...scenario, cast: undefined, otherRole: scenario.cast?.[0]?.name || scenario.otherRole, otherPosition: scenario.cast?.[0]?.position || scenario.otherPosition }) : changeCast([{ name: scenario.otherRole || "角色一", position: scenario.otherPosition || "有自己的立场" }, { name: "角色二", position: "对这件事有不同的看法" }])}><option value="single">一位对话角色</option><option value="multiple">多人物场景（2—3 人）</option></select></label>
    {scenario.cast?.map((member, index) => <div className="cast-member" key={index}>
      <strong>角色 {index + 1}</strong>
      <label className="field"><span>姓名或称呼</span><input value={member.name} maxLength={20} required onChange={(event) => changeCast(scenario.cast!.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item))} /></label>
      <label className="field"><span>这个人的立场</span><input value={member.position} maxLength={120} minLength={2} required onChange={(event) => changeCast(scenario.cast!.map((item, itemIndex) => itemIndex === index ? { ...item, position: event.target.value } : item))} /></label>
    </div>)}
    {scenario.cast && <div className="cast-actions"><button type="button" className="text-button" disabled={scenario.cast.length >= 3} onClick={() => changeCast([...scenario.cast!, { name: "角色三", position: "还有自己的顾虑" }])}>＋ 增加角色</button>{scenario.cast.length > 2 && <button type="button" className="text-button" onClick={() => changeCast(scenario.cast!.slice(0, -1))}>移除最后一个角色</button>}</div>}
  </div>;
}
