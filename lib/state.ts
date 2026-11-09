import { z } from "zod";

export const stateKeys = ["tension", "openness", "trust", "conflict", "hurt", "expression_coverage"] as const;
export const sceneStateSchema = z.object({
  tension: z.number().int().min(0).max(100),
  openness: z.number().int().min(0).max(100),
  trust: z.number().int().min(0).max(100),
  conflict: z.number().int().min(0).max(100),
  hurt: z.number().int().min(0).max(100),
  expression_coverage: z.number().int().min(0).max(100),
});
export type SceneState = z.infer<typeof sceneStateSchema>;
export type StateDelta = Record<keyof SceneState, number>;

export const initialState: SceneState = {
  tension: 45, openness: 55, trust: 50, conflict: 45, hurt: 55, expression_coverage: 10,
};

const maxDelta: StateDelta = {
  tension: 12, openness: 10, trust: 8, conflict: 12, hurt: 10, expression_coverage: 15,
};

export function applyStateChange(current: SceneState, suggested: StateDelta): SceneState {
  const next = { ...current };
  for (const key of stateKeys) {
    const bounded = Math.max(-maxDelta[key], Math.min(maxDelta[key], Math.trunc(suggested[key])));
    next[key] = Math.max(0, Math.min(100, current[key] + bounded));
  }
  return next;
}

export function stateDescription(state: SceneState): string {
  if (state.tension >= 80 || state.conflict >= 80) return "气氛很紧绷，对方可能需要一点空间。";
  if (state.openness >= 65 && state.trust >= 60) return "对方开始愿意听你说下去。";
  if (state.openness <= 30) return "对方正在收起表达，回应可能变少。";
  return "分歧仍在，但对话还没有结束。";
}
