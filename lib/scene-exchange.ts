import { z } from "zod";
import { scenarioSchema, type Scenario } from "./scenario";

const exchangeSchema = z.object({ version: z.literal(1), scenario: scenarioSchema });

export function exportScene(scenario: Scenario): string {
  const safe = scenarioSchema.parse({ ...scenario, userConcern: "", unsaidWords: "", memoryNote: "", memoryEnabled: false, userAvatar: undefined, otherAvatar: undefined });
  return JSON.stringify({ version: 1, scenario: safe }, null, 2);
}

export function importScene(text: string): Scenario {
  if (text.length > 50000) throw new Error("场景文件太大，请使用小于 50 KB 的 JSON 文件。");
  try { return exchangeSchema.parse(JSON.parse(text)).scenario; }
  catch { throw new Error("场景文件格式不正确，请导入 ERIS 导出的 JSON 文件。"); }
}
