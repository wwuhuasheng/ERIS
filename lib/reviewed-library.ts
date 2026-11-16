import { presetScenarios } from "./preset-scenarios";

// Templates become public only after their ID is added here during repository review.
const publishedIds = new Set([
  "relative-request", "old-friend-grievance", "confession", "apology", "interview-failure",
  "interview-followups", "mentor-delay", "mentor-direction", "colleague-boundary",
]);

export const reviewedScenes = presetScenarios.filter((preset) => publishedIds.has(preset.id));
