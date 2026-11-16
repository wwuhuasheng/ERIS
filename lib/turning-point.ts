import type { SceneState } from "./state";

export function shouldMarkTurningPoint(
  previous: SceneState,
  next: SceneState,
  modelCandidate: boolean,
  userTurnCount: number,
  existingPoints: number,
): boolean {
  if (existingPoints >= 3) return false;
  if (modelCandidate) return true;
  if (existingPoints > 0) return false;
  const movement = Math.abs(next.tension - previous.tension)
    + Math.abs(next.openness - previous.openness)
    + Math.abs(next.conflict - previous.conflict)
    + Math.abs(next.expression_coverage - previous.expression_coverage);
  return (userTurnCount >= 4 && movement >= 8) || userTurnCount >= 8;
}
