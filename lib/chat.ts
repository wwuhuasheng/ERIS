import { z } from "zod";
import { scenarioSchema } from "./scenario";
import { sceneStateSchema } from "./state";

export const messageSchema = z.object({
  id: z.string().uuid(),
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(4000),
});

export const accessSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("test"), username: z.string().min(1).max(100), passphrase: z.string().min(1).max(200) }),
  z.object({ kind: z.literal("own"), apiKey: z.string().min(10).max(300), model: z.enum(["deepseek-flash", "deepseek-v4-pro"]) }),
]);

export const chatRequestSchema = z.object({
  scenario: scenarioSchema,
  state: sceneStateSchema,
  messages: z.array(messageSchema).min(1).max(30),
  access: accessSchema,
});

export const modelReplySchema = z.object({
  reply: z.string().trim().min(1).max(2000),
  visible_emotion: z.string().trim().min(1).max(80),
  conflict_move: z.enum(["defend", "counter", "avoid", "silence", "leave", "soften", "ask"]),
  state_change: z.object({
    tension: z.number().finite(), openness: z.number().finite(), trust: z.number().finite(),
    conflict: z.number().finite(), hurt: z.number().finite(), expression_coverage: z.number().finite(),
  }),
  change_reason: z.string().trim().min(1).max(240),
  turning_point_candidate: z.boolean(),
  director_signal: z.enum(["continue", "cool_down", "escalate", "end"]),
});

export type ChatRequest = z.infer<typeof chatRequestSchema>;
export type Message = z.infer<typeof messageSchema>;
export type ModelReply = z.infer<typeof modelReplySchema>;
