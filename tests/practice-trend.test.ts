import { describe, expect, it } from "vitest";
import { practiceTrend } from "../lib/practice-trend";
import type { ScenarioTimelineEntry } from "../lib/persistence";

const entry = (sessionId: string, status: ScenarioTimelineEntry["status"], turns: number, coverage: number | null): ScenarioTimelineEntry => ({
  sessionId, parentSessionId: null, mode: "confront", status, createdAt: "2026-11-17T00:00:00Z",
  endingType: status === "completed" ? "exit" : null, userFeeling: null, userTurns: turns, expressionCoverage: coverage,
});

describe("practice trend", () => {
  it("compares only completed attempts with a user response", () => {
    expect(practiceTrend([entry("a", "completed", 4, 30), entry("b", "paused", 2, 80), entry("c", "completed", 7, 60)])).toEqual([
      { sessionId: "a", label: "第 1 次", userTurns: 4, expressionCoverage: 30, endingType: "exit" },
      { sessionId: "c", label: "第 2 次", userTurns: 7, expressionCoverage: 60, endingType: "exit" },
    ]);
  });
});
