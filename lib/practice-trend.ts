import type { ScenarioTimelineEntry } from "./persistence";

export type PracticeTrendPoint = {
  sessionId: string;
  label: string;
  userTurns: number;
  expressionCoverage: number | null;
  endingType: ScenarioTimelineEntry["endingType"];
};

export function practiceTrend(entries: ScenarioTimelineEntry[]): PracticeTrendPoint[] {
  return entries
    .filter((entry) => entry.status === "completed" && entry.userTurns > 0)
    .map((entry, index) => ({
      sessionId: entry.sessionId,
      label: `第 ${index + 1} 次`,
      userTurns: entry.userTurns,
      expressionCoverage: entry.expressionCoverage,
      endingType: entry.endingType,
    }));
}
