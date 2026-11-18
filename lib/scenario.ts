import { z } from "zod";
import { validCompactImage } from "./chat-media";

export const templateIds = ["friend", "relationship", "boundary", "work"] as const;
export const styles = ["defensive", "avoidant", "direct", "sensitive"] as const;
export const modes = ["vent", "confront", "continue", "perspective"] as const;

export const castMemberSchema = z.object({
  name: z.string().trim().min(1).max(20).regex(/^[^：:\n]+$/),
  position: z.string().trim().min(2).max(120),
});

export const scenarioSchema = z.object({
  template: z.enum(templateIds),
  title: z.string().trim().min(2).max(80),
  background: z.string().trim().min(10).max(1200),
  userRole: z.string().trim().min(1).max(80),
  otherRole: z.string().trim().min(1).max(80),
  relationship: z.string().trim().min(2).max(120),
  otherPosition: z.string().trim().min(2).max(500),
  userGoal: z.string().trim().min(2).max(500),
  userConcern: z.string().trim().max(500),
  unsaidWords: z.string().trim().max(1000),
  excludedTopics: z.string().trim().max(500),
  style: z.enum(styles),
  intensity: z.number().int().min(1).max(3),
  mode: z.enum(modes),
  cast: z.array(castMemberSchema).min(2).max(3).refine((cast) => new Set(cast.map((member) => member.name)).size === cast.length, "角色姓名不能重复").optional(),
  memoryNote: z.string().trim().max(1000).optional(),
  memoryEnabled: z.boolean().optional(),
  userAvatar: z.string().max(3000).refine((value) => validCompactImage(value), "头像图片格式无效").optional(),
  otherAvatar: z.string().max(3000).refine((value) => validCompactImage(value), "头像图片格式无效").optional(),
});

export type Scenario = z.infer<typeof scenarioSchema>;

const castMarker = "ERIS_CAST_V1\n";
const sceneMarker = "ERIS_SCENE_V2\n";
const mediaMarker = "ERIS_SCENE_V3\n";

export function encodeScenePosition(scenario: Scenario): string {
  if (scenario.userAvatar || scenario.otherAvatar) return mediaMarker + JSON.stringify({ position: scenario.otherPosition, cast: scenario.cast, memoryNote: scenario.memoryNote || "", memoryEnabled: Boolean(scenario.memoryEnabled), userAvatar: scenario.userAvatar, otherAvatar: scenario.otherAvatar });
  if (scenario.memoryNote?.trim() || scenario.memoryEnabled) return sceneMarker + JSON.stringify({ position: scenario.otherPosition, cast: scenario.cast, memoryNote: scenario.memoryNote || "", memoryEnabled: Boolean(scenario.memoryEnabled) });
  return scenario.cast?.length ? castMarker + JSON.stringify({ position: scenario.otherPosition, cast: scenario.cast }) : scenario.otherPosition;
}

export function decodeScenePosition(value: string): { position: string; cast?: Scenario["cast"]; memoryNote?: string; memoryEnabled?: boolean; userAvatar?: string; otherAvatar?: string } {
  if (value.startsWith(mediaMarker)) return z.object({ position: z.string(), cast: z.array(castMemberSchema).min(2).max(3).optional(), memoryNote: z.string().max(1000), memoryEnabled: z.boolean(), userAvatar: z.string().max(3000).refine(validCompactImage).optional(), otherAvatar: z.string().max(3000).refine(validCompactImage).optional() }).parse(JSON.parse(value.slice(mediaMarker.length)));
  if (value.startsWith(sceneMarker)) return z.object({ position: z.string(), cast: z.array(castMemberSchema).min(2).max(3).optional(), memoryNote: z.string().max(1000), memoryEnabled: z.boolean() }).parse(JSON.parse(value.slice(sceneMarker.length)));
  if (!value.startsWith(castMarker)) return { position: value };
  const parsed = z.object({ position: z.string(), cast: z.array(castMemberSchema).min(2).max(3) }).parse(JSON.parse(value.slice(castMarker.length)));
  return { position: parsed.position, cast: parsed.cast };
}

export const fixedScenario: Scenario = {
  template: "friend",
  title: "又一次失约",
  background: "你和好友林澈约好周末见面。他再次临时取消，这是近两个月第三次。你曾说过被放鸽子让你难过，但他觉得自己最近的工作和家庭压力已经让他尽力了。今晚你决定直接谈这件事。",
  userRole: "被多次临时取消约定的朋友",
  otherRole: "好友林澈",
  relationship: "相识多年的好友，最近联系渐少",
  otherPosition: "我知道临时取消伤到你，但我不认同每次失约都等于不在乎；我也不愿一直被拿过去的事追着算账。",
  userGoal: "说清楚一次又一次失约带来的伤害，弄明白彼此还愿不愿意维护关系。",
  userConcern: "怕表达不满后对方彻底疏远。",
  unsaidWords: "我不是要你随叫随到，我只是希望你别总让我最后一个知道计划变了。",
  excludedTopics: "",
  style: "defensive",
  intensity: 2,
  mode: "confront",
};

export const templates: Record<Scenario["template"], { label: string; description: string }> = {
  friend: { label: "友情与失约", description: "谈谈朋友之间没有说开的事" },
  relationship: { label: "恋爱与关系", description: "表达亲密关系里的期待与委屈" },
  boundary: { label: "人情与边界", description: "面对请求、面子与拒绝的压力" },
  work: { label: "职场沟通", description: "练习与同事、上级或导师对话" },
};

export const scenarioHints: Record<Scenario["template"], { title: string; background: string; userRole: string; otherRole: string; relationship: string; otherPosition: string; userGoal: string }> = {
  friend: { title: "例如：又一次临时取消", background: "写下那件让你们有分歧的事，以及它发生的时间和经过", userRole: "例如：一直在等消息的朋友", otherRole: "例如：经常临时改约的朋友", relationship: "例如：认识多年的好友", otherPosition: "对方为什么觉得自己也有道理？", userGoal: "你最希望对方听见什么？" },
  relationship: { title: "例如：总被推迟的约定", background: "写下最近一次让你在意的相处片段", userRole: "例如：想谈清楚期待的伴侣", otherRole: "例如：觉得被催促的伴侣", relationship: "例如：交往两年的伴侣", otherPosition: "对方可能在守护什么期待或边界？", userGoal: "你想把哪份感受说清楚？" },
  boundary: { title: "例如：这次我想拒绝", background: "写下对方提出的请求，以及你为什么为难", userRole: "例如：不想再答应的朋友", otherRole: "例如：希望你帮忙的亲戚", relationship: "例如：有往来的亲友", otherPosition: "对方为什么觉得这个请求合理？", userGoal: "你希望怎样表达自己的边界？" },
  work: { title: "例如：临时加来的任务", background: "写下具体的工作事件、分歧和已经发生的沟通", userRole: "例如：需要说明排期的同事", otherRole: "例如：催进度的负责人", relationship: "例如：同一项目的同事", otherPosition: "对方在意的工作结果或压力是什么？", userGoal: "你希望达成怎样的工作沟通？" },
};

export function blankScenario(template: Scenario["template"] = "friend"): Scenario {
  return {
    template, title: "", background: "", userRole: "", otherRole: "", relationship: "",
    otherPosition: "", userGoal: "", userConcern: "", unsaidWords: "", excludedTopics: "",
    style: "defensive", intensity: 2, mode: "confront",
  };
}

export const styleLabels: Record<Scenario["style"], string> = {
  defensive: "容易防御", avoidant: "倾向回避", direct: "直接强硬", sensitive: "敏感细腻",
};

export const modeLabels: Record<Scenario["mode"], string> = {
  vent: "宣泄", confront: "对峙", continue: "冲突续写", perspective: "换位体验",
};

export function toPerspectiveScenario(original: Scenario): Scenario {
  return {
    ...original,
    title: `换位：${original.title}`.slice(0, 80),
    userRole: original.otherRole,
    otherRole: original.userRole,
    otherPosition: original.userGoal,
    userGoal: original.otherPosition,
    userConcern: "",
    unsaidWords: "",
    style: "direct",
    mode: "perspective",
    cast: undefined,
    memoryNote: "",
    memoryEnabled: false,
    userAvatar: original.otherAvatar,
    otherAvatar: original.userAvatar,
  };
}
