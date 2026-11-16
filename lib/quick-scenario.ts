import { scenarioSchema, type Scenario } from "./scenario";

export type QuickScenarioInput = {
  event: string;
  counterpart: string;
  goal: string;
  template: Scenario["template"];
  intensity: Scenario["intensity"];
};

export function makeQuickScenario(input: QuickScenarioInput): Scenario {
  const event = input.event.trim();
  const counterpart = input.counterpart.trim();
  const goal = input.goal.trim();
  return scenarioSchema.parse({
    template: input.template,
    title: `想和${counterpart}说的话`.slice(0, 80),
    background: event,
    userRole: "想把话说出来的人",
    otherRole: counterpart,
    relationship: "正在发生分歧的两个人",
    otherPosition: "对这件事有自己的理由和边界，暂时没有完全认同用户的想法。",
    userGoal: goal,
    userConcern: "",
    unsaidWords: "",
    excludedTopics: "",
    style: "defensive",
    intensity: input.intensity,
    mode: "vent",
  });
}
