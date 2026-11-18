import fixtures from "../tests/fixtures/qa-scenarios.json";
import { scenarioSchema, type Scenario } from "./scenario";

export type PresetScenario = { id: string; scenario: Scenario; opening: string };

export const presetScenarios: PresetScenario[] = fixtures.map((item) => ({
  id: item.id,
  scenario: scenarioSchema.parse(item.scenario),
  opening: item.opening,
}));
