import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Message } from "./chat";
import { toPerspectiveScenario, type Scenario } from "./scenario";
import { initialState, type SceneState } from "./state";

export type StoredMessage = Message & { state?: SceneState; turningPoint?: boolean };

export type StoredSession = {
  scenarioId: string;
  sessionId: string;
  scenario: Scenario;
  messages: StoredMessage[];
  state: SceneState;
  status: "active" | "paused" | "completed";
};

export type StoredSessionSummary = { id: string; title: string; status: StoredSession["status"]; createdAt: string };

let browserClient: SupabaseClient | null = null;

export function persistenceConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
}

export function authClient(): SupabaseClient {
  if (!persistenceConfigured()) throw new Error("尚未配置 Supabase；无法注册、登录或保存历史记录。");
  if (!browserClient) browserClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true },
  });
  return browserClient;
}

async function identity(): Promise<{ db: SupabaseClient; ownerId: string }> {
  const db = authClient();
  const { data, error } = await db.auth.getUser();
  if (error) throw error;
  if (!data.user || data.user.is_anonymous) throw new Error("请先注册或登录，才能保存和查看个人记录。");
  return { db, ownerId: data.user.id };
}

function scenarioRow(value: Scenario, ownerId: string) {
  return {
    owner_id: ownerId, title: value.title, template_type: value.template, background: value.background,
    user_role: value.userRole, counterpart_role: value.otherRole, relationship: value.relationship,
    other_position: value.otherPosition, user_intent: value.userGoal, primary_concern: value.userConcern,
    unsaid_words: value.unsaidWords, counterpart_style: value.style, intensity: value.intensity,
    excluded_topics: value.excludedTopics,
  };
}

function fromScenarioRow(row: Record<string, unknown>, mode: Scenario["mode"]): Scenario {
  return {
    template: row.template_type as Scenario["template"], title: row.title as string,
    background: row.background as string, userRole: row.user_role as string,
    otherRole: row.counterpart_role as string, relationship: row.relationship as string,
    otherPosition: row.other_position as string, userGoal: row.user_intent as string,
    userConcern: row.primary_concern as string, unsaidWords: row.unsaid_words as string,
    excludedTopics: row.excluded_topics as string, style: row.counterpart_style as Scenario["style"],
    intensity: row.intensity as number, mode,
  };
}

export async function createStoredSession(scenario: Scenario): Promise<StoredSession> {
  const { db, ownerId } = await identity();
  const scene = await db.from("scenarios").insert(scenarioRow(scenario, ownerId)).select("id").single();
  if (scene.error || !scene.data) throw scene.error || new Error("无法保存场景。");
  const session = await db.from("sessions").insert({ owner_id: ownerId, scenario_id: scene.data.id, mode: scenario.mode }).select("id").single();
  if (session.error || !session.data) {
    await db.from("scenarios").delete().eq("id", scene.data.id);
    throw session.error || new Error("无法创建会话。");
  }
  const state = await db.from("scene_states").insert({ owner_id: ownerId, session_id: session.data.id, ...initialState, change_reason: "初始状态" });
  if (state.error) {
    await db.from("scenarios").delete().eq("id", scene.data.id);
    throw state.error;
  }
  return { scenarioId: scene.data.id, sessionId: session.data.id, scenario, messages: [], state: initialState, status: "active" };
}

export async function listStoredSessions(): Promise<StoredSessionSummary[]> {
  const { db } = await identity();
  const sessions = await db.from("sessions").select("id,scenario_id,status,created_at").order("created_at", { ascending: false }).limit(50);
  if (sessions.error) throw sessions.error;
  const rows = sessions.data || [];
  if (!rows.length) return [];
  const scenarioIds = [...new Set(rows.map((row) => row.scenario_id))];
  const scenes = await db.from("scenarios").select("id,title").in("id", scenarioIds);
  if (scenes.error) throw scenes.error;
  const titles = new Map((scenes.data || []).map((scene) => [scene.id, scene.title]));
  return rows.map((row) => ({
    id: row.id as string,
    title: titles.get(row.scenario_id) || "未命名情境",
    status: row.status as StoredSession["status"],
    createdAt: row.created_at as string,
  }));
}

export async function loadStoredSession(sessionId: string): Promise<StoredSession | null> {
  const { db } = await identity();
  const session = await db.from("sessions").select("id,scenario_id,mode,status").eq("id", sessionId).maybeSingle();
  if (session.error) throw session.error;
  if (!session.data) return null;
  const [scene, messages, states, points] = await Promise.all([
    db.from("scenarios").select("*").eq("id", session.data.scenario_id).single(),
    db.from("messages").select("id,role,content,sequence_no").eq("session_id", session.data.id).order("sequence_no", { ascending: true }),
    db.from("scene_states").select("message_id,tension,openness,trust,conflict,hurt,expression_coverage").eq("session_id", session.data.id).order("created_at", { ascending: true }),
    db.from("turning_points").select("message_id").eq("session_id", session.data.id),
  ]);
  if (scene.error || messages.error || states.error || points.error || !scene.data || !states.data?.length) throw scene.error || messages.error || states.error || points.error || new Error("会话读取失败。");
  const stateByMessage = new Map<string, SceneState>();
  for (const row of states.data) if (row.message_id) stateByMessage.set(row.message_id, row as SceneState);
  const pointIds = new Set((points.data || []).map((point) => point.message_id));
  const latestState = states.data.at(-1)! as SceneState;
  return {
    scenarioId: session.data.scenario_id, sessionId: session.data.id,
    scenario: session.data.mode === "perspective" ? toPerspectiveScenario(fromScenarioRow(scene.data, "continue")) : fromScenarioRow(scene.data, session.data.mode as Scenario["mode"]),
    messages: (messages.data || []).map((message) => ({ id: message.id, role: message.role === "counterpart" ? "assistant" as const : "user" as const, content: message.content, state: stateByMessage.get(message.id), turningPoint: pointIds.has(message.id) })),
    state: latestState,
    status: session.data.status as StoredSession["status"],
  };
}

export async function loadLatestSession(): Promise<StoredSession | null> {
  const { db } = await identity();
  const session = await db.from("sessions").select("id").in("status", ["active", "paused"]).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (session.error) throw session.error;
  return session.data ? loadStoredSession(session.data.id) : null;
}

export async function storeMessage(sessionId: string, message: Message, sequenceNo: number): Promise<void> {
  const { db, ownerId } = await identity();
  const { error } = await db.from("messages").insert({ id: message.id, owner_id: ownerId, session_id: sessionId, role: message.role === "assistant" ? "counterpart" : "user", content: message.content, sequence_no: sequenceNo });
  if (error?.code === "23505") {
    const existing = await db.from("messages").select("id,session_id,content,sequence_no").eq("id", message.id).maybeSingle();
    if (existing.error || !existing.data || existing.data.session_id !== sessionId || existing.data.content !== message.content || existing.data.sequence_no !== sequenceNo) throw error;
  } else if (error) throw error;
}

export async function storeReplyState(sessionId: string, messageId: string, state: SceneState, reason: string, turningPoint: boolean): Promise<void> {
  const { db, ownerId } = await identity();
  const { error } = await db.from("scene_states").insert({ owner_id: ownerId, session_id: sessionId, message_id: messageId, ...state, change_reason: reason });
  if (error) throw error;
  if (turningPoint) {
    const count = await db.from("turning_points").select("id", { count: "exact", head: true }).eq("session_id", sessionId);
    if (count.error) throw count.error;
    if ((count.count || 0) >= 3) return;
    const { error: pointError } = await db.from("turning_points").insert({ owner_id: ownerId, session_id: sessionId, message_id: messageId, title: "对话出现转折", explanation: reason, impact: "角色的回应或场景状态发生变化" });
    if (pointError) throw pointError;
  }
}

export async function setSessionStatus(sessionId: string, status: StoredSession["status"]): Promise<void> {
  const { db } = await identity();
  const { error } = await db.from("sessions").update({ status, completed_at: status === "completed" ? new Date().toISOString() : null }).eq("id", sessionId);
  if (error) throw error;
}

export async function updateScenarioIntensity(scenarioId: string, intensity: number): Promise<void> {
  const { db } = await identity();
  const { error } = await db.from("scenarios").update({ intensity, updated_at: new Date().toISOString() }).eq("id", scenarioId);
  if (error) throw error;
}

export async function deleteStoredScenario(scenarioId: string): Promise<void> {
  const { db } = await identity();
  const { error } = await db.from("scenarios").delete().eq("id", scenarioId);
  if (error) throw error;
}

export async function createBranch(parentSessionId: string, scenarioId: string, fromMessageId: string, messages: Message[], state: SceneState, mode: Scenario["mode"]): Promise<string> {
  const { db, ownerId } = await identity();
  const session = await db.from("sessions").insert({ owner_id: ownerId, scenario_id: scenarioId, parent_session_id: parentSessionId, branch_from_message_id: fromMessageId, mode }).select("id").single();
  if (session.error || !session.data) throw session.error || new Error("无法创建分支。");
  const sessionId = session.data.id as string;
  if (messages.length) {
    const copied = messages.map((message, index) => ({ id: crypto.randomUUID(), owner_id: ownerId, session_id: sessionId, role: message.role === "assistant" ? "counterpart" : "user", content: message.content, sequence_no: index }));
    const { error } = await db.from("messages").insert(copied);
    if (error) throw error;
  }
  const { error } = await db.from("scene_states").insert({ owner_id: ownerId, session_id: sessionId, ...state, change_reason: "从关键节点创建分支" });
  if (error) throw error;
  return sessionId;
}

export async function createPerspectiveSession(parentSessionId: string, scenarioId: string, fromMessageId: string, spokenMessages: Message[], state: SceneState): Promise<string> {
  const { db, ownerId } = await identity();
  const session = await db.from("sessions").insert({ owner_id: ownerId, scenario_id: scenarioId, parent_session_id: parentSessionId, branch_from_message_id: fromMessageId, mode: "perspective", active_role: "counterpart" }).select("id").single();
  if (session.error || !session.data) throw session.error || new Error("无法创建换位会话。");
  const sessionId = session.data.id as string;
  if (spokenMessages.length) {
    const copied = spokenMessages.map((message, index) => ({ id: crypto.randomUUID(), owner_id: ownerId, session_id: sessionId, role: message.role === "assistant" ? "user" : "counterpart", content: message.content, sequence_no: index }));
    const { error } = await db.from("messages").insert(copied);
    if (error) throw error;
  }
  const { error } = await db.from("scene_states").insert({ owner_id: ownerId, session_id: sessionId, ...state, change_reason: "从公开对话片段换位" });
  if (error) throw error;
  return sessionId;
}

export async function saveSessionEnding(sessionId: string, coreExpression: string, peakMoment: string, reflection: string | null, feeling: string): Promise<void> {
  const { db, ownerId } = await identity();
  const { error } = await db.from("session_endings").upsert({
    owner_id: ownerId, session_id: sessionId, core_expression: coreExpression.slice(0, 4000),
    peak_moment: peakMoment.slice(0, 4000), ending_type: "exit", optional_reflection: reflection,
    user_feeling: feeling,
  }, { onConflict: "session_id" });
  if (error) throw error;
}
