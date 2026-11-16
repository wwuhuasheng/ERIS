"use client";

import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { ChatRequest, Message, ModelReply } from "@/lib/chat";
import { blankScenario, fixedScenario, modeLabels, scenarioHints, scenarioSchema, styleLabels, templates, toPerspectiveScenario, type Scenario } from "@/lib/scenario";
import { initialState, stateDescription, type SceneState } from "@/lib/state";
import { authClient, createBranch, createPerspectiveSession, createStoredSession, deleteStoredScenario, listStoredSessions, loadLatestSession, loadStoredSession, loadScenarioTimeline, persistenceConfigured, setSessionStatus, storeMessage, storeAssistantTurn, updateScenarioIntensity, saveSessionEnding, saveSessionFeedback, type EndingType, type FeedbackType, type StoredSession, type StoredSessionSummary, type ScenarioTimelineEntry } from "@/lib/persistence";
import { buildReflection } from "@/lib/reflection";
import { normalizePhone } from "@/lib/phone";
import { phoneAccountEmail, testAccountEmail } from "@/lib/account-email";
import { shouldMarkTurningPoint } from "@/lib/turning-point";
import { reviewedScenes } from "@/lib/reviewed-library";
import { makeQuickScenario } from "@/lib/quick-scenario";
import { VoiceInputButton } from "./voice-input-button";
import { ExpressionPanel } from "./expression-panel";
import { exportScene, importScene } from "@/lib/scene-exchange";
import { CastEditor } from "./cast-editor";

type Step = "welcome" | "presets" | "quick" | "create" | "confirm" | "chat" | "landing" | "history";
type Access = ChatRequest["access"];
type Turn = Message & { emotion?: string; move?: string; turningPoint?: boolean; state?: SceneState; reason?: string };

const endingLabels: Record<EndingType, string> = {
  escalated: "冲突升级", stalemate: "暂时僵持", broken: "关系中断", cooled: "气氛缓和", exit: "主动停下",
};

function TimelinePanel({ entries, selectedId }: { entries: ScenarioTimelineEntry[]; selectedId: string }) {
  if (!entries.length) return null;
  const completed = entries.filter((entry) => entry.endingType);
  return <section className="timeline-panel" aria-label="关系时间线">
    <h2>这段关系的练习时间线</h2>
    <p className="muted">同一场景的重试与换位会并列显示。表达覆盖度来自模拟状态，仅供比较练习过程。</p>
    <ol>{entries.map((entry, index) => <li key={entry.sessionId} className={entry.sessionId === selectedId ? "selected" : ""}>
      <span className="timeline-index">{String(index + 1).padStart(2, "0")}</span>
      <div><strong>{entry.parentSessionId ? entry.mode === "perspective" ? "换位体验" : "平行分支" : "原始对话"}</strong><small>{new Date(entry.createdAt).toLocaleString("zh-CN")} · {entry.userTurns} 轮表达</small><span>{entry.endingType ? endingLabels[entry.endingType] : entry.status === "paused" ? "已暂停" : "进行中"}{entry.userFeeling ? ` · ${entry.userFeeling}` : ""}{entry.expressionCoverage !== null ? ` · 表达覆盖 ${entry.expressionCoverage}%` : ""}</span></div>
    </li>)}</ol>
    {completed.length >= 2 && <div className="outcome-compare"><h3>平行结局</h3><p>同一场景出现了 {completed.length} 个已记录的结局。它们展示不同尝试的走向，不代表现实结果。</p><div>{completed.map((entry) => <span key={entry.sessionId}>{endingLabels[entry.endingType!]} · {entry.userTurns} 轮</span>)}</div></div>}
  </section>;
}

function makeMessage(role: Message["role"], content: string): Turn {
  return { id: crypto.randomUUID(), role, content };
}

function field(label: string, value: string, onChange: (value: string) => void, options?: { long?: boolean; placeholder?: string; required?: boolean; min?: number; max?: number }) {
  return <label className="field"><span>{label}</span>{options?.long
    ? <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={options.placeholder} required={options.required} minLength={options.min} maxLength={options.max} rows={3} />
    : <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={options?.placeholder} required={options?.required} minLength={options?.min} maxLength={options?.max} />}</label>;
}

async function credentialRequest(method: "GET" | "PUT" | "DELETE", apiKey?: string): Promise<{ configured: boolean }> {
  const { data } = await authClient().auth.getSession();
  if (!data.session || data.session.user.is_anonymous) throw new Error("请先登录账号。");
  const response = await fetch("/api/credentials", {
    method,
    headers: { Authorization: "Bearer " + data.session.access_token, ...(method === "PUT" ? { "Content-Type": "application/json" } : {}) },
    body: method === "PUT" ? JSON.stringify({ apiKey }) : undefined,
    cache: "no-store",
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "API Key 操作失败。");
  return result as { configured: boolean };
}

type AuthStatus = "loading" | "guest" | "ready" | "unconfigured";
type AuthMode = "login" | "register" | "test" | "legacy";

export default function HomePage() {
  const [authStatus, setAuthStatus] = useState<AuthStatus>("loading");
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [user, setUser] = useState<User | null>(null);
  const [phone, setPhone] = useState("");
  const [legacyEmail, setLegacyEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [testUsername, setTestUsername] = useState("");
  const [testPassphrase, setTestPassphrase] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authNotice, setAuthNotice] = useState("");

  useEffect(() => {
    if (!persistenceConfigured()) {
      setAuthStatus("unconfigured");
      return;
    }
    const db = authClient();
    const { data: { subscription } } = db.auth.onAuthStateChange((event, session) => {
      if (event !== "INITIAL_SESSION" && event !== "SIGNED_IN" && event !== "SIGNED_OUT") return;
      const activeUser = session?.user && !session.user.is_anonymous ? session.user : null;
      setUser(activeUser);
      setAuthStatus(activeUser ? "ready" : "guest");
    });
    return () => subscription.unsubscribe();
  }, []);

  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (authBusy) return;
    const normalizedPhone = authMode === "test" || authMode === "legacy" ? null : normalizePhone(phone);
    if (authMode !== "test" && authMode !== "legacy" && !normalizedPhone) {
      setAuthError("请输入有效手机号：中国大陆可填 11 位，其他地区请填写带国家区号的号码。");
      return;
    }
    if (authMode === "register" && password !== confirmPassword) {
      setAuthError("两次输入的密码不一致。");
      return;
    }
    setAuthBusy(true);
    setAuthError("");
    setAuthNotice("");
    try {
      const db = authClient();
      if (authMode === "test") {
        const email = testAccountEmail(testUsername);
        if (!email) throw new Error("请输入有效的测试账号。");
        const { data, error } = await db.auth.signInWithPassword({ email, password: testPassphrase });
        if (error) throw new Error("测试账号或暗号不正确。");
        if (data.user.app_metadata?.eris_test_account !== true) {
          await db.auth.signOut({ scope: "local" });
          throw new Error("这个账号没有测试入口权限。");
        }
        setTestPassphrase("");
        setUser(data.user);
        setAuthStatus("ready");
      } else if (authMode === "legacy") {
        const { data, error } = await db.auth.signInWithPassword({ email: legacyEmail.trim(), password });
        if (error) throw new Error("旧邮箱账号或密码不正确。");
        setPassword("");
        setUser(data.user);
        setAuthStatus("ready");
      } else {
        const email = phoneAccountEmail(phone);
        if (!email) throw new Error("手机号格式不正确。");
        if (authMode === "register") {
          const response = await fetch("/api/auth/register", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ phone, password }), cache: "no-store",
          });
          const result = await response.json();
          if (!response.ok) throw new Error(result.error || "注册失败，请稍后再试。");
        }
        const { data, error } = await db.auth.signInWithPassword({ email, password });
        if (error) {
          if (authMode === "login" && error.code === "invalid_credentials") {
            setAuthMode("register");
            setAuthNotice("此号码尚未登录成功。若还没注册，请用保留的手机号继续注册；若已有账号，请返回登录检查密码。");
            setPassword("");
            return;
          }
          throw error;
        }
        if (data.user.app_metadata?.eris_account_type !== "phone_alias") {
          await db.auth.signOut({ scope: "local" });
          throw new Error("账号类型不匹配，请联系管理员。");
        }
        setPassword("");
        setConfirmPassword("");
        if (!data.user.is_anonymous) {
          setUser(data.user);
          setAuthStatus("ready");
        }
      }
    } catch (cause) {
      setAuthError(cause instanceof Error ? cause.message : "账号操作失败，请重试。");
    } finally {
      setAuthBusy(false);
    }
  }

  async function signOut() {
    const { error } = await authClient().auth.signOut({ scope: "local" });
    if (error) {
      window.alert("退出失败，请重试。");
      return;
    }
    setUser(null);
    setAuthStatus("guest");
  }

  if (authStatus === "ready" && user) {
    const isTestAccount = user.app_metadata?.eris_test_account === true;
    const phoneLabel = user.user_metadata?.display_phone;
    const accountLabel = isTestAccount ? "测试账号" : typeof phoneLabel === "string" ? phoneLabel : user.phone || user.email || "已登录";
    return <Experience key={user.id} userEmail={accountLabel} isTestAccount={isTestAccount} onSignOut={signOut} />;
  }

  return <main className="shell">
    <header className="site-header"><Link className="brand" href="/">✳ <span>ERIS</span></Link><span className="header-note">给未说出口的话，一个可重来的空间</span><span className="phase">账号入口</span></header>
    <section className="panel narrow auth-panel">
      <div className="eyebrow">WELCOME TO ERIS</div>
      {authStatus === "loading" ? <><h1>正在确认账号…</h1><p className="muted">请稍候。</p></> :
        authStatus === "unconfigured" ? <><h1>先连接账号服务</h1><p className="lead">正式注册和个人历史记录需要 Supabase。请先在 .env.local 中填写 NEXT_PUBLIC_SUPABASE_URL 与 NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY，然后重启应用。</p><Link className="text-button" href="/about">查看简介 →</Link></> :
        <><h1>{authMode === "login" ? "欢迎回来。" : authMode === "register" ? "创建你的账号。" : authMode === "test" ? "测试账号登录。" : "旧邮箱账号登录。"}</h1><p className="lead">{authMode === "test" ? "输入固定测试账号和暗号，直接进入项目测试入口。" : authMode === "legacy" ? "只供原有邮箱账号取回自己的历史记录；新账号请用手机号形式注册。" : "手机号只作为账号名，不发送验证码。注册后，对话历史和已保存的 DeepSeek API Key 会绑定在这个账号下。"}</p>
          <div className="auth-tabs"><button type="button" aria-pressed={authMode === "login"} onClick={() => { setAuthMode("login"); setAuthError(""); setAuthNotice(""); }}>手机号登录</button><button type="button" aria-pressed={authMode === "register"} onClick={() => { setAuthMode("register"); setAuthError(""); setAuthNotice(""); }}>手机号注册</button><button type="button" aria-pressed={authMode === "test"} onClick={() => { setAuthMode("test"); setAuthError(""); setAuthNotice(""); }}>测试账号</button></div>
          <form className="scenario-form" onSubmit={submitAuth}>
            {authMode === "test" ? <><label className="field"><span>测试账号</span><input value={testUsername} onChange={(event) => setTestUsername(event.target.value)} autoComplete="username" maxLength={64} required /></label><label className="field"><span>暗号</span><input type="password" value={testPassphrase} onChange={(event) => setTestPassphrase(event.target.value)} autoComplete="current-password" required /></label></> : <><label className="field"><span>{authMode === "legacy" ? "旧邮箱" : "手机号"}</span><input type={authMode === "legacy" ? "email" : "tel"} value={authMode === "legacy" ? legacyEmail : phone} onChange={(event) => authMode === "legacy" ? setLegacyEmail(event.target.value) : setPhone(event.target.value)} autoComplete={authMode === "legacy" ? "email" : "tel"} inputMode={authMode === "legacy" ? "email" : "tel"} placeholder={authMode === "legacy" ? "原来注册时使用的邮箱" : "中国大陆 11 位手机号，或 +国家区号"} required /></label><label className="field"><span>密码</span><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={authMode === "register" ? "new-password" : "current-password"} minLength={authMode === "register" ? 8 : undefined} required /></label></>}
            {authMode === "register" && <label className="field"><span>确认密码</span><input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" minLength={8} required /></label>}
            {authError && <p className="error" role="alert">{authError}</p>}
            {authNotice && <p className="auth-notice" role="status">{authNotice}</p>}
            <button className="primary" disabled={authBusy}>{authBusy ? "请稍候…" : authMode === "register" ? "注册账号 →" : authMode === "test" ? "进入测试入口 →" : "登录并继续 →"}</button>
          </form><button className="text-button" type="button" onClick={() => { setAuthMode(authMode === "legacy" ? "login" : "legacy"); setAuthError(""); setAuthNotice(""); }}>{authMode === "legacy" ? "← 返回手机号登录" : "已有旧邮箱账号？从这里登录"}</button><Link className="text-button auth-about" href="/about">先看简介 →</Link></>}
    </section>
    <footer>ERIS · 一种可能性，不是现实预测。若你或他人正处于危险，请联系当地紧急服务或可信任的人。</footer>
  </main>;
}

function Experience({ userEmail, isTestAccount, onSignOut }: { userEmail: string; isTestAccount: boolean; onSignOut: () => Promise<void> }) {
  const [step, setStep] = useState<Step>("welcome");
  const [scenario, setScenario] = useState<Scenario>(fixedScenario);
  const [presetOpening, setPresetOpening] = useState("");
  const [quickEvent, setQuickEvent] = useState("");
  const [quickCounterpart, setQuickCounterpart] = useState("");
  const [quickGoal, setQuickGoal] = useState("");
  const [quickTemplate, setQuickTemplate] = useState<Scenario["template"]>("friend");
  const [quickIntensity, setQuickIntensity] = useState<Scenario["intensity"]>(2);
  const [quickTemporary, setQuickTemporary] = useState(false);
  const [temporaryMode, setTemporaryMode] = useState(false);
  const [quickDeadline, setQuickDeadline] = useState<number | null>(null);
  const [quickRemaining, setQuickRemaining] = useState(300);
  const scenarioDrafts = useRef<Partial<Record<Scenario["template"], Scenario>>>({});
  const scenarioBeforeEdit = useRef<Scenario | null>(null);
  const [editingSession, setEditingSession] = useState(false);
  const [accessKind, setAccessKind] = useState<Access["kind"]>(isTestAccount ? "test" : "own_saved");
  const [accessOpen, setAccessOpen] = useState(true);
  const [apiKey, setApiKey] = useState("");
  const [apiSaved, setApiSaved] = useState(false);
  const [apiBusy, setApiBusy] = useState(false);
  const [apiError, setApiError] = useState("");
  const [ownModel, setOwnModel] = useState<"deepseek-flash" | "deepseek-v4-pro">("deepseek-flash");
  const [messages, setMessages] = useState<Turn[]>([]);
  const [sceneState, setSceneState] = useState<SceneState>(initialState);
  const [draft, setDraft] = useState("");
  const [typingPauses, setTypingPauses] = useState(0);
  const lastTypedAt = useRef<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [safety, setSafety] = useState("");
  const [formError, setFormError] = useState("");
  const [showReflection, setShowReflection] = useState(false);
  const [scenarioId, setScenarioId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const sessionGeneration = useRef(0);
  const [pending, setPending] = useState<Turn | null>(null);
  const [storageError, setStorageError] = useState("");
  const [userFeeling, setUserFeeling] = useState("");
  const [endingType, setEndingType] = useState<EndingType>("exit");
  const [feedbackType, setFeedbackType] = useState<FeedbackType | "">("");
  const [feedbackDetail, setFeedbackDetail] = useState("");
  const [feedbackSaved, setFeedbackSaved] = useState(false);
  const [directorCue, setDirectorCue] = useState("");
  const [leftRole, setLeftRole] = useState(false);
  const [historyEntries, setHistoryEntries] = useState<StoredSessionSummary[]>([]);
  const [historyQuery, setHistoryQuery] = useState("");
  const [historyFilter, setHistoryFilter] = useState("");
  const [selectedHistory, setSelectedHistory] = useState<StoredSession | null>(null);
  const [timelineEntries, setTimelineEntries] = useState<ScenarioTimelineEntry[]>([]);
  const [historyBusy, setHistoryBusy] = useState(false);
  const stepBeforeHistory = useRef<Step>("welcome");

  function selectSession(id: string | null) {
    sessionGeneration.current += 1;
    setSessionId(id);
  }

  useEffect(() => {
    if (!persistenceConfigured()) return;
    let cancelled = false;
    const initialGeneration = sessionGeneration.current;
    loadLatestSession().then((stored) => {
      if (cancelled || !stored || sessionGeneration.current !== initialGeneration) return;
      setScenario(stored.scenario);
      setScenarioId(stored.scenarioId);
      selectSession(stored.sessionId);
      setMessages(stored.messages);
      setSceneState(stored.state);
      const last = stored.messages.at(-1);
      if (last?.role === "user") { setPending(last); setDraft(last.content); }
      setStep((current) => current === "history" ? current : stored.status === "paused" ? "welcome" : "chat");
    }).catch((cause) => { if (!cancelled) setStorageError(cause instanceof Error ? cause.message : "无法恢复上次的对话。"); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    credentialRequest("GET").then((result) => { if (!cancelled) setApiSaved(result.configured); })
      .catch((cause) => { if (!cancelled) setApiError(cause instanceof Error ? cause.message : "无法读取 API Key 状态。"); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (quickDeadline === null) return;
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((quickDeadline - Date.now()) / 1000));
      setQuickRemaining(remaining);
      if (remaining === 0) {
        setLeftRole(true);
        setStep((current) => current === "chat" ? "landing" : current);
      }
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [quickDeadline]);

  async function saveOwnKey() {
    if (apiBusy || !apiKey.trim()) return;
    setApiBusy(true); setApiError("");
    try {
      const result = await credentialRequest("PUT", apiKey.trim());
      setApiSaved(result.configured);
      setApiKey("");
    } catch (cause) { setApiError(cause instanceof Error ? cause.message : "API Key 保存失败。"); }
    finally { setApiBusy(false); }
  }

  async function removeOwnKey() {
    if (apiBusy || !window.confirm("确定移除已保存的 DeepSeek API Key 吗？")) return;
    setApiBusy(true); setApiError("");
    try {
      await credentialRequest("DELETE");
      setApiSaved(false);
      setApiKey("");
    } catch (cause) { setApiError(cause instanceof Error ? cause.message : "API Key 移除失败。"); }
    finally { setApiBusy(false); }
  }

  const userTurnCount = messages.filter((message) => message.role === "user").length;
  const turningPoints = messages.filter((message) => message.turningPoint && message.role === "assistant").slice(0, 3);
  const reflection = buildReflection(messages, scenario.unsaidWords);

  function updateScenario<K extends keyof Scenario>(key: K, value: Scenario[K]) {
    setScenario((previous) => ({ ...previous, [key]: value }));
  }

  function updateDraftFromKeyboard(value: string) {
    const now = Date.now();
    if (lastTypedAt.current !== null && now - lastTypedAt.current > 1500 && now - lastTypedAt.current < 120000) {
      setTypingPauses((count) => count + 1);
    }
    lastTypedAt.current = now;
    setDraft(value);
  }

  function chooseTemplate(template: Scenario["template"]) {
    scenarioDrafts.current[scenario.template] = scenario;
    setScenario(scenarioDrafts.current[template] || blankScenario(template));
    setFormError("");
  }

  function createScenario() {
    scenarioDrafts.current = {};
    scenarioBeforeEdit.current = null;
    setEditingSession(false);
    setScenario(blankScenario());
    setPresetOpening("");
    setFormError("");
    setStorageError("");
    setStep("create");
  }

  function editScenario() {
    scenarioBeforeEdit.current = scenario;
    scenarioDrafts.current = { [scenario.template]: scenario };
    setEditingSession(true);
    setPresetOpening("");
    setFormError("");
    setStep("create");
  }

  function cancelScenarioEdit() {
    if (editingSession) {
      if (scenarioBeforeEdit.current) setScenario(scenarioBeforeEdit.current);
      setEditingSession(false);
      setStep("chat");
    } else {
      setStep("welcome");
    }
  }

  async function begin(nextScenario: Scenario = scenario, initialDraft = presetOpening, quick = temporaryMode && quickDeadline !== null, temporary = temporaryMode) {
    if (editingSession && (messages.length > 0 || draft.trim()) && !window.confirm("修改场景会开始一段新对话。若未配置 Supabase，当前页面中的旧对话将无法恢复。继续吗？")) return;
    if (temporary) {
      setScenarioId(null);
      selectSession(`temporary:${crypto.randomUUID()}`);
      setStorageError("");
    } else if (persistenceConfigured()) {
      try {
        const stored = await createStoredSession(nextScenario);
        setScenarioId(stored.scenarioId);
        selectSession(stored.sessionId);
        setStorageError("");
      } catch (cause) {
        setStorageError(cause instanceof Error ? cause.message : "无法保存场景，请检查 Supabase 配置。");
        return;
      }
    } else { setScenarioId(null); selectSession(null); }
    setScenario(nextScenario);
    setTemporaryMode(temporary);
    setQuickDeadline(quick ? Date.now() + 5 * 60 * 1000 : null);
    setQuickRemaining(300);
    setPending(null);
    setMessages([]);
    setSceneState(initialState);
    setDraft(initialDraft);
    setTypingPauses(0);
    lastTypedAt.current = null;
    setError("");
    setSafety("");
    setShowReflection(false);
    setUserFeeling("");
    setEndingType("exit");
    setFeedbackType("");
    setFeedbackDetail("");
    setFeedbackSaved(false);
    setDirectorCue("");
    setLeftRole(false);
    setEditingSession(false);
    setStep("chat");
  }

  async function startQuick(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const nextScenario = makeQuickScenario({ event: quickEvent, counterpart: quickCounterpart, goal: quickGoal, template: quickTemplate, intensity: quickIntensity });
      setFormError("");
      setPresetOpening("");
      await begin(nextScenario, "", true, quickTemporary);
    } catch {
      setFormError("请简要写下发生的事、对方是谁，以及你想说清楚什么。");
    }
  }

  function validateScenario(event: FormEvent) {
    event.preventDefault();
    const result = scenarioSchema.safeParse(scenario);
    if (!result.success) {
      const labels: Record<keyof Scenario, string> = {
        template: "场景模板", title: "情境名字", background: "发生了什么", userRole: "你的身份",
        otherRole: "对方身份", relationship: "你们的关系", otherPosition: "对方立场",
        userGoal: "你的目标", userConcern: "你的担忧", unsaidWords: "没说出口的话",
        excludedTopics: "不希望涉及的内容", style: "对方风格", intensity: "模拟强度", mode: "交互模式", cast: "对话人物",
      };
      const first = result.error.issues[0];
      setFormError(`请检查「${labels[first.path[0] as keyof Scenario] || "场景内容"}」：${first.code === "too_small" ? "内容太短" : first.code === "too_big" ? "内容太长" : "格式不正确"}。`);
      return;
    }
    setFormError("");
    setStep("confirm");
  }

  function downloadScene() {
    try {
      const content = exportScene(scenario);
      const url = URL.createObjectURL(new Blob([content], { type: "application/json" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = "eris-scene.json";
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setFormError("");
    } catch { setFormError("请先填完场景内容，再导出文件。"); }
  }

  async function uploadScene(file: File | undefined) {
    if (!file) return;
    try {
      const imported = importScene(await file.text());
      setScenario(imported);
      setPresetOpening("");
      setFormError("");
    } catch (cause) { setFormError(cause instanceof Error ? cause.message : "导入失败。"); }
  }

  async function send(event: FormEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || busy || (userTurnCount >= 15 && !pending) || (quickDeadline !== null && quickRemaining === 0)) return;
    if (!sessionId) { setError("对话尚未建立，请重新进入场景。"); return; }
    const requestGeneration = sessionGeneration.current;
    const access: Access = accessKind === "test"
      ? { kind: "test" }
      : { kind: "own_saved", model: ownModel };
    if (access.kind === "own_saved" && !apiSaved) {
      setAccessOpen(true);
      setError("请先保存你的 DeepSeek API Key。");
      return;
    }
    const userMessage = pending || makeMessage("user", text);
    const nextMessages = pending ? messages : [...messages, userMessage];
    setBusy(true);
    lastTypedAt.current = null;
    setError("");
    try {
      if (!pending) {
        if (!temporaryMode) await storeMessage(sessionId, userMessage, messages.length);
        if (sessionGeneration.current === requestGeneration) {
          setPending(userMessage);
          setMessages(nextMessages);
        }
      }
      const { data: authData } = await authClient().auth.getSession();
      if (!authData.session || authData.session.user.is_anonymous) throw new Error("登录已失效，请重新登录。");
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + authData.session.access_token },
        body: JSON.stringify({ scenario, state: sceneState, messages: nextMessages.map(({ id, role, content }) => ({ id, role, content })), access }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "请求失败，请重试。");
      if (result.safety) {
        const notice: Turn = { ...makeMessage("assistant", result.message), emotion: "系统安全提示", state: sceneState };
        if (sessionGeneration.current === requestGeneration) setSafety(result.message);
        try {
          if (!temporaryMode) {
            await storeAssistantTurn(sessionId, notice, nextMessages.length, sceneState, "安全中止普通模拟", false);
            await setSessionStatus(sessionId, "paused");
          }
          if (sessionGeneration.current === requestGeneration) {
            setMessages([...nextMessages, notice]);
            setPending(null);
            setDraft("");
          }
        } catch (cause) {
          if (sessionGeneration.current === requestGeneration) setStorageError(cause instanceof Error ? cause.message : "安全提示保存失败；原输入保留。");
        }
        if (sessionGeneration.current === requestGeneration) setStep("landing");
        return;
      }
      const reply = result as ModelReply & { state: SceneState };
      const markPoint = shouldMarkTurningPoint(sceneState, reply.state, reply.turning_point_candidate, userTurnCount + (pending ? 0 : 1), turningPoints.length);
      const assistantMessage: Turn = { ...makeMessage("assistant", reply.reply), emotion: reply.visible_emotion, move: reply.conflict_move, turningPoint: markPoint, state: reply.state, reason: reply.change_reason };
      if (!temporaryMode) await storeAssistantTurn(sessionId, assistantMessage, nextMessages.length, reply.state, reply.change_reason, markPoint);
      if (sessionGeneration.current !== requestGeneration) return;
      setMessages([...nextMessages, assistantMessage]);
      setSceneState(reply.state);
      setDirectorCue(reply.director_signal === "cool_down" ? "这段对话有些紧绷。你可以降低强度，或者随时停下。" : reply.director_signal === "end" ? "这段对话似乎到了一个停顿点。你可以结束，也可以继续。" : reply.director_signal === "escalate" ? "对话正在升温。想缓一缓的话，可以降低强度或先停下。" : "");
      setAccessOpen(false);
      setPending(null);
      setDraft("");
      setStorageError("");
    } catch (cause) {
      if (sessionGeneration.current === requestGeneration) setError(cause instanceof Error ? cause.message : "请求失败，请重试。");
    } finally {
      setBusy(false);
    }
  }

  async function rewind(pointId: string) {
    const index = messages.findIndex((message) => message.id === pointId);
    if (index < 1) return;
    const priorMessages = messages.slice(0, index - 1);
    const priorState = [...priorMessages].reverse().find((message) => message.state)?.state || initialState;
    if (sessionId && scenarioId) {
      try {
        const branchId = await createBranch(sessionId, scenarioId, pointId, priorMessages, priorState, scenario.mode);
        const branch = await loadStoredSession(branchId);
        if (!branch) throw new Error("无法读取新分支。");
        selectSession(branch.sessionId);
        setMessages(branch.messages);
      } catch (cause) {
        setStorageError(cause instanceof Error ? cause.message : "分支创建失败。");
        return;
      }
    } else { setMessages(priorMessages); }
    setSceneState(priorState);
    setDraft(messages[index - 1]?.content || "");
    setPending(null);
    setStep("chat");
    setShowReflection(false);
    setDirectorCue("");
    setFeedbackType("");
    setFeedbackDetail("");
    setFeedbackSaved(false);
    setEndingType("exit");
    setUserFeeling("");
  }

  async function startPerspective() {
    if (scenario.mode === "perspective" || scenario.cast?.length) return;
    const point = turningPoints.at(-1) || messages.filter((message) => message.role === "assistant" && message.emotion !== "系统安全提示").at(-1);
    if (!point) return;
    const index = messages.findIndex((message) => message.id === point.id);
    const spoken = messages.slice(0, index);
    const priorState = [...spoken].reverse().find((message) => message.state)?.state || initialState;
    const swapped = spoken.map((message) => ({ ...message, role: message.role === "user" ? "assistant" as const : "user" as const }));
    if (sessionId && scenarioId) {
      try {
        const branchId = await createPerspectiveSession(sessionId, scenarioId, point.id, spoken, priorState);
        const branch = await loadStoredSession(branchId);
        if (!branch) throw new Error("无法读取换位会话。");
        selectSession(branch.sessionId);
        setMessages(branch.messages);
        setScenario(branch.scenario);
      } catch (cause) { setStorageError(cause instanceof Error ? cause.message : "换位会话创建失败。"); return; }
    } else { setMessages(swapped); setScenario(toPerspectiveScenario(scenario)); }
    setSceneState(priorState);
    setDraft("");
    setPending(null);
    setSafety("");
    setShowReflection(false);
    setDirectorCue("");
    setFeedbackType("");
    setFeedbackDetail("");
    setFeedbackSaved(false);
    setEndingType("exit");
    setUserFeeling("");
    setStep("chat");
  }

  async function removeCurrent() {
    if (temporaryMode) { discardTemporarySession(); return; }
    if (!window.confirm("确定永久删除这段场景和所有分支记录吗？此操作无法撤销。")) return;
    try {
      if (scenarioId) await deleteStoredScenario(scenarioId);
      setMessages([]); setPending(null); setScenarioId(null); selectSession(null); setDraft(""); setStep("welcome");
    } catch (cause) { setStorageError(cause instanceof Error ? cause.message : "删除失败。"); }
  }

  async function lowerIntensity() {
    try {
      if (scenarioId) await updateScenarioIntensity(scenarioId, 1);
      updateScenario("intensity", 1);
      setDirectorCue("");
      await changeStatus("active");
    } catch (cause) { setStorageError(cause instanceof Error ? cause.message : "强度调整失败。"); }
  }

  async function changeIntensity(intensity: number) {
    try {
      if (scenarioId) await updateScenarioIntensity(scenarioId, intensity);
      updateScenario("intensity", intensity);
      setStorageError("");
    } catch (cause) { setStorageError(cause instanceof Error ? cause.message : "强度调整失败。"); }
  }

  async function leaveConversation(jumpOut: boolean) {
    setLeftRole(jumpOut);
    await changeStatus("paused", true);
  }

  async function submitFeedback() {
    if (!sessionId || temporaryMode || !feedbackType || feedbackSaved) return;
    try {
      await saveSessionFeedback(sessionId, feedbackType, feedbackDetail);
      setFeedbackSaved(true);
      setStorageError("");
    } catch (cause) { setStorageError(cause instanceof Error ? cause.message : "反馈保存失败，请重试。"); }
  }

  async function changeStatus(status: "active" | "paused" | "completed", landOnPause = false) {
    if (sessionId && !temporaryMode) {
      try {
        if (status === "completed") await saveSessionEnding(sessionId, reflection.coreExpression, reflection.peakMoment, showReflection ? reflection.text : null, userFeeling, endingType);
        await setSessionStatus(sessionId, status);
      } catch (cause) { setStorageError(cause instanceof Error ? cause.message : "保存会话状态失败。"); return; }
    }
    if (status === "active") setLeftRole(false);
    if (status === "completed") {
      selectSession(null);
      setScenarioId(null);
      setQuickDeadline(null);
      if (temporaryMode) {
        setMessages([]); setPending(null); setDraft("");
        setQuickEvent(""); setQuickCounterpart(""); setQuickGoal("");
        setScenario(fixedScenario);
      }
      setTemporaryMode(false);
    }
    setStep(status === "active" ? "chat" : status === "paused" && landOnPause ? "landing" : "welcome");
  }

  async function loadHistory(search: string) {
    setHistoryBusy(true);
    setStorageError("");
    try { setHistoryEntries(await listStoredSessions(search)); }
    catch (cause) { setStorageError(cause instanceof Error ? cause.message : "历史记录读取失败。"); }
    finally { setHistoryBusy(false); }
  }

  async function openHistory() {
    if (step === "history") return;
    stepBeforeHistory.current = temporaryMode ? "welcome" : step;
    if (temporaryMode) discardTemporarySession();
    setSelectedHistory(null);
    setTimelineEntries([]);
    setHistoryQuery("");
    setHistoryFilter("");
    setStep("history");
    await loadHistory("");
  }

  function discardTemporarySession() {
    selectSession(null);
    setScenarioId(null);
    setMessages([]);
    setPending(null);
    setDraft("");
    setQuickEvent("");
    setQuickCounterpart("");
    setQuickGoal("");
    setScenario(fixedScenario);
    setTemporaryMode(false);
    setQuickDeadline(null);
    setStep("welcome");
  }

  async function searchHistory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const search = historyQuery.trim().slice(0, 80);
    setHistoryFilter(search);
    await loadHistory(search);
  }

  async function viewHistory(sessionId: string) {
    setHistoryBusy(true);
    setStorageError("");
    try {
      const stored = await loadStoredSession(sessionId);
      if (!stored) throw new Error("这段记录不存在或你没有查看权限。");
      const timeline = await loadScenarioTimeline(stored.scenarioId);
      setSelectedHistory(stored);
      setTimelineEntries(timeline);
    } catch (cause) {
      setStorageError(cause instanceof Error ? cause.message : "对话读取失败。");
    } finally {
      setHistoryBusy(false);
    }
  }

  async function resumeHistory() {
    const stored = selectedHistory;
    if (!stored || stored.status === "completed" || historyBusy) return;
    if (sessionId !== stored.sessionId && draft.trim() && !window.confirm("当前对话有未发送的草稿。切换后会清空这份草稿，继续吗？")) return;
    setHistoryBusy(true);
    setStorageError("");
    try {
      await setSessionStatus(stored.sessionId, "active");
      setQuickDeadline(null);
      setTemporaryMode(false);
      setScenario(stored.scenario);
      setScenarioId(stored.scenarioId);
      selectSession(stored.sessionId);
      setMessages(stored.messages);
      setSceneState(stored.state);
      const last = stored.messages.at(-1);
      setPending(last?.role === "user" ? last : null);
      setDraft(last?.role === "user" ? last.content : "");
      setTypingPauses(0);
      lastTypedAt.current = null;
      setSafety("");
      setError("");
      setDirectorCue("");
      setShowReflection(false);
      setFeedbackType("");
      setFeedbackDetail("");
      setFeedbackSaved(false);
      setUserFeeling("");
      setEndingType("exit");
      setSelectedHistory(null);
      setStep("chat");
    } catch (cause) {
      setStorageError(cause instanceof Error ? cause.message : "无法继续这段对话。");
    } finally {
      setHistoryBusy(false);
    }
  }

  async function deleteHistory() {
    const stored = selectedHistory;
    if (!stored || historyBusy || !window.confirm("确定永久删除这段场景及所有分支吗？此操作无法撤销。")) return;
    setHistoryBusy(true);
    setStorageError("");
    try {
      await deleteStoredScenario(stored.scenarioId);
      if (scenarioId === stored.scenarioId) {
        setScenarioId(null);
        selectSession(null);
        setMessages([]);
        setPending(null);
        setDraft("");
        stepBeforeHistory.current = "welcome";
      }
      setSelectedHistory(null);
      setHistoryEntries(await listStoredSessions(historyFilter));
    } catch (cause) {
      setStorageError(cause instanceof Error ? cause.message : "删除历史记录失败。");
    } finally {
      setHistoryBusy(false);
    }
  }

  return <main className="shell">
    <header className="site-header"><button className="brand" onClick={() => temporaryMode ? discardTemporarySession() : setStep("welcome")}>✳ <span>ERIS</span></button><span className="header-note">给未说出口的话，一个可重来的空间</span><div className="header-actions"><button type="button" onClick={() => void openHistory()}>历史记录</button><span className="account-email" title={userEmail}>{userEmail}</span><button type="button" onClick={() => void onSignOut()}>退出</button></div></header>

    {step === "welcome" && <section className="hero">{storageError && <p className="error" role="alert">{storageError}</p>}
      <div className="eyebrow">RELATIONSHIP SIMULATION · 关系情境模拟</div>
      <h1>那些没能说出口的话，<br /><em>可以先在这里说。</em></h1>
      <p>与拥有自己立场的虚构角色进行一段困难对话。你可以表达、争辩、暂停，也可以试试另一种说法。</p>
      <div className="hero-actions">{sessionId && <button className="secondary" onClick={() => void changeStatus("active")}>继续上次对话</button>}<button className="primary" onClick={() => setStep("quick")}>快速说一段 <span>→</span></button><button className="secondary" onClick={() => setStep("presets")}>选择固定场景</button><button className="secondary" onClick={createScenario}>详细创建</button></div>
      <Link href="/about" className="intro-link"><span>简介</span><span aria-hidden="true">→</span></Link>
      <p className="disclaimer">这是 AI 生成的可能情境，不代表现实人物的想法，也不提供心理诊断或治疗。</p>
    </section>}

    {step === "quick" && <section className="panel narrow quick-panel">
      <div className="eyebrow">QUICK VENT · 快捷宣泄</div>
      <h1>先用几句话，搭起这段对话。</h1>
      <p className="muted">写下最关键的三件事，就可以直接开始一段五分钟的对话。你也可以选临时模式，结束或离开后不留历史记录。</p>
      <form className="scenario-form" onSubmit={startQuick}>
        <label className="field"><span>发生了什么？</span><textarea value={quickEvent} onChange={(event) => setQuickEvent(event.target.value)} minLength={10} maxLength={1200} rows={3} required placeholder="比如：约好的事又被临时取消了……" /></label>
        <div className="two-cols"><label className="field"><span>你想和谁说？</span><input value={quickCounterpart} onChange={(event) => setQuickCounterpart(event.target.value)} maxLength={80} required placeholder="朋友、伴侣、同事……" /></label><label className="field"><span>你想说清楚什么？</span><input value={quickGoal} onChange={(event) => setQuickGoal(event.target.value)} minLength={2} maxLength={500} required placeholder="我的感受或我的边界" /></label></div>
        <div className="two-cols"><label className="field"><span>关系类型</span><select value={quickTemplate} onChange={(event) => setQuickTemplate(event.target.value as Scenario["template"])}>{Object.entries(templates).map(([id, item]) => <option key={id} value={id}>{item.label}</option>)}</select></label><label className="field"><span>冲突强度</span><select value={quickIntensity} onChange={(event) => setQuickIntensity(Number(event.target.value) as Scenario["intensity"])}><option value={1}>轻 · 保留余地</option><option value={2}>中 · 有分歧</option><option value={3}>强 · 更直接</option></select></label></div>
        <label className="quick-temporary"><input type="checkbox" checked={quickTemporary} onChange={(event) => setQuickTemporary(event.target.checked)} /><span><strong>用完即删</strong><small>这段对话只留在当前页面，不写入历史记录。刷新或离开后无法找回。</small></span></label>
        {formError && <p className="error" role="alert">{formError}</p>}{storageError && <p className="error" role="alert">{storageError}</p>}
        <div className="row"><button className="text-button" type="button" onClick={() => setStep("welcome")}>← 返回</button><button className="primary" type="submit">开始对话 →</button></div>
      </form>
    </section>}

    {step === "presets" && <section className="panel preset-panel">
      <div className="eyebrow">SCENE LIBRARY · 场景模板库</div>
      <h1>选一段情境，先把话说出来。</h1>
      <p className="muted">这里只展示经过项目内容审核、纳入发布名单的模板。开场白只是草稿，你可以改写或清空。</p>
      <div className="preset-grid">{reviewedScenes.map((preset) => <button className="preset-card" type="button" key={preset.id} onClick={() => { setScenario({ ...preset.scenario }); setPresetOpening(preset.opening); setEditingSession(false); setStorageError(""); setStep("confirm"); }}><small>{templates[preset.scenario.template].label}</small><strong>{preset.scenario.title}</strong><span>{preset.scenario.background}</span><em>进入这段情境 →</em></button>)}</div>
      <button className="text-button" type="button" onClick={() => setStep("welcome")}>← 返回首页</button>
    </section>}

    {step === "history" && <section className="panel narrow history-panel">
      <div className="eyebrow">MY CONVERSATIONS · 我的记录</div>
      <h1>{selectedHistory ? selectedHistory.scenario.title : "历史对话"}</h1>
      <p className="muted">自动保存到当前账号。可在最近 50 段对话中按场景标题或聊天内容查找，只有你能查看自己的记录。</p>
      {!selectedHistory && <form className="history-search" onSubmit={searchHistory}><input type="search" value={historyQuery} onChange={(event) => setHistoryQuery(event.target.value)} maxLength={80} placeholder="搜索场景或聊天内容" aria-label="搜索历史对话" /><button className="secondary" disabled={historyBusy}>查找</button></form>}
      {storageError && <p className="error" role="alert">{storageError}</p>}
      {historyBusy ? <p className="muted">正在读取…</p> : selectedHistory ?
        <div className="history-transcript">{selectedHistory.messages.length ? selectedHistory.messages.map((message) => <div className={"history-message " + message.role} key={message.id}><small>{message.role === "user" ? "你" : selectedHistory.scenario.otherRole}</small><p>{message.content}</p></div>) : <p className="muted">这段对话还没有消息。</p>}</div> :
        historyEntries.length ? <div className="history-list">{historyEntries.map((item) => <button type="button" key={item.id} onClick={() => void viewHistory(item.id)}><span><strong>{item.title}</strong><small>{new Date(item.createdAt).toLocaleString("zh-CN")} · {item.status === "active" ? "进行中" : item.status === "paused" ? "已暂停" : "已完成"}</small></span><span aria-hidden="true">→</span></button>)}</div> :
          <p className="muted">{historyFilter ? "没有找到匹配的对话。" : "还没有历史记录。开始一段对话后，这里会出现你的记录。"}</p>}
      {selectedHistory && !historyBusy && <TimelinePanel entries={timelineEntries} selectedId={selectedHistory.sessionId} />}
      {selectedHistory && !historyBusy && <div className="history-actions">{selectedHistory.status !== "completed" && <button className="secondary" type="button" onClick={() => void resumeHistory()}>继续这段对话</button>}<button className="text-button" type="button" onClick={() => void deleteHistory()}>永久删除这段场景</button></div>}
      <div className="row"><button className="text-button" type="button" onClick={() => selectedHistory ? setSelectedHistory(null) : setStep(stepBeforeHistory.current)}>← {selectedHistory ? "返回记录列表" : "返回"}</button></div>
    </section>}

    {step === "create" && <section className="panel narrow"><div className="eyebrow">01 / {editingSession ? "修改场景" : "创建场景"}</div><h1>把你的情境，写成一段可探索的对话。</h1><p className="muted">选择模板后填写自己的故事；切换模板会保留各自的草稿。请勿输入身份证号、住址等敏感资料。</p>
      {storageError && <p className="error" role="alert">{storageError}</p>}<form onSubmit={validateScenario} className="scenario-form">
        <label className="field"><span>场景模板</span><select value={scenario.template} onChange={(e) => chooseTemplate(e.target.value as Scenario["template"])}>{Object.entries(templates).map(([id, item]) => <option key={id} value={id}>{item.label} · {item.description}</option>)}</select></label>
        {field("给这段情境起个名字", scenario.title, (v) => updateScenario("title", v), { required: true, min: 2, max: 80, placeholder: scenarioHints[scenario.template].title })}
        {field("发生了什么？", scenario.background, (v) => updateScenario("background", v), { long: true, required: true, min: 10, max: 1200, placeholder: scenarioHints[scenario.template].background })}
        {field("你在其中的身份", scenario.userRole, (v) => updateScenario("userRole", v), { required: true, min: 1, max: 80, placeholder: scenarioHints[scenario.template].userRole })}
        <CastEditor scenario={scenario} onChange={setScenario} />
        {!scenario.cast && field("对方的身份", scenario.otherRole, (v) => updateScenario("otherRole", v), { required: true, min: 1, max: 80, placeholder: scenarioHints[scenario.template].otherRole })}
        {field("你们的关系", scenario.relationship, (v) => updateScenario("relationship", v), { required: true, min: 2, max: 120, placeholder: scenarioHints[scenario.template].relationship })}
        {!scenario.cast && field("对方可能坚持什么立场？", scenario.otherPosition, (v) => updateScenario("otherPosition", v), { long: true, required: true, min: 2, max: 500, placeholder: scenarioHints[scenario.template].otherPosition })}
        {field("你希望说清楚什么？", scenario.userGoal, (v) => updateScenario("userGoal", v), { long: true, required: true, min: 2, max: 500, placeholder: scenarioHints[scenario.template].userGoal })}
        {field("你最担心什么？", scenario.userConcern, (v) => updateScenario("userConcern", v), { long: true, max: 500 })}
        {field("还没说出口的话（可选）", scenario.unsaidWords, (v) => updateScenario("unsaidWords", v), { long: true, max: 1000 })}
        {field("不希望涉及的内容（可选）", scenario.excludedTopics, (v) => updateScenario("excludedTopics", v), { max: 500 })}
        <div className="two-cols"><label className="field"><span>对方风格</span><select value={scenario.style} onChange={(e) => updateScenario("style", e.target.value as Scenario["style"])}>{Object.entries(styleLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="field"><span>模拟强度</span><select value={scenario.intensity} onChange={(e) => updateScenario("intensity", Number(e.target.value))}><option value={1}>轻 · 保留余地</option><option value={2}>中 · 有分歧</option><option value={3}>强 · 更直接</option></select></label></div>
        <label className="field"><span>交互模式</span><select value={scenario.mode} onChange={(e) => updateScenario("mode", e.target.value as Scenario["mode"])}>{Object.entries(modeLabels).filter(([value]) => value !== "perspective").map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <div className="scene-exchange"><h2>场景创作者工具</h2><p className="muted">导出 JSON 后可以分享给别人导入。导出文件会自动清空“担忧”和“没说出口的话”；发布前仍请检查背景是否含私人信息。</p><div><button className="secondary" type="button" onClick={downloadScene}>导出场景文件</button><label className="field"><span>导入 ERIS 场景文件</span><input type="file" accept="application/json,.json" onChange={(event) => void uploadScene(event.target.files?.[0])} /></label></div></div>
        {formError && <p className="error">{formError}</p>}
        <div className="row"><button type="button" className="text-button" onClick={cancelScenarioEdit}>← {editingSession ? "取消修改" : "返回"}</button><button className="primary">确认场景 →</button></div>
      </form>
    </section>}

    {step === "confirm" && <section className="panel narrow"><div className="eyebrow">02 / 场景确认</div><h1>{scenario.title}</h1><p className="lead">{scenario.background}</p><div className="summary-grid"><div><small>你们的关系</small><strong>{scenario.relationship}</strong></div><div><small>对方立场</small><strong>{scenario.otherPosition}</strong></div><div><small>你的目标</small><strong>{scenario.userGoal}</strong></div><div><small>模拟设定</small><strong>{styleLabels[scenario.style]} · {modeLabels[scenario.mode]} · 强度 {scenario.intensity}</strong></div></div><p className="muted">对方不会直接知道你尚未说出口的话和内心担忧。模拟不是现实预测。{presetOpening && " 进入后会预填一段可编辑的开场白。"}</p>{storageError && <p className="error" role="alert">{storageError}</p>}<div className="row"><button className="text-button" onClick={() => setStep(presetOpening ? "presets" : "create")}>← {presetOpening ? "重选场景" : "修改场景"}</button><button className="primary" onClick={() => void begin()}>{editingSession ? "应用更改，开始新对话 →" : "进入对话 →"}</button></div></section>}

    {step === "chat" && <section className="chat-layout"><aside className="chat-sidebar"><details className="scene-note"><summary><span className="eyebrow">这段情境</span><strong>{scenario.title}</strong></summary><p>{scenario.background}</p><p className="scene-status">{modeLabels[scenario.mode]} · 第 {userTurnCount} / 15 轮 · {stateDescription(sceneState)}{temporaryMode && " · 临时对话，不保存"}</p><div className="scene-controls"><label className="field"><span>对话强度</span><select value={scenario.intensity} onChange={(e) => void changeIntensity(Number(e.target.value))}><option value={1}>轻 · 保留余地</option><option value={2}>中 · 有分歧</option><option value={3}>强 · 更直接</option></select></label><div className="scene-controls-actions"><button className="text-button" onClick={editScenario}>编辑场景</button><button className="text-button" onClick={removeCurrent}>删除这段对话</button></div></div></details></aside>
      <div className="chat-main"><div className="chat-top"><div className="chat-persona"><span className="avatar" aria-hidden="true">{scenario.otherRole.trim().slice(-1) || "人"}</span><div><strong>{scenario.otherRole}</strong><span>{quickDeadline !== null ? `五分钟宣泄 · 剩余 ${Math.floor(quickRemaining / 60)}:${String(quickRemaining % 60).padStart(2, "0")}` : "一段可能发生的对话"}</span></div></div><div className="chat-actions"><button className="pause-button" type="button" onClick={() => void lowerIntensity()} disabled={scenario.intensity === 1}>降低强度</button><button className="pause-button" type="button" onClick={() => void leaveConversation(true)}>跳出角色</button><button className="pause-button" type="button" onClick={() => void leaveConversation(false)}>结束对话</button><button className="pause-button" type="button" onClick={() => void changeStatus("paused")}>暂停</button></div></div>
        <div className="messages" aria-live="polite">{messages.length === 0 && <div className="opening"><span className="opening-mark">✳</span><p>从你想说的那句话开始。</p><span>{scenario.otherRole} 会以自己的立场回应。你不必把话说得很完整。</span></div>}{messages.map((message) => <div className={"message-row " + message.role} key={message.id}>{message.role === "assistant" && <span className="message-avatar" aria-hidden="true">{scenario.otherRole.trim().slice(-1) || "人"}</span>}<div className={"message " + message.role}><small>{message.role === "user" ? "你" : scenario.otherRole}</small><p>{message.content}</p></div></div>)}{busy && <div className="message-row assistant"><span className="message-avatar" aria-hidden="true">{scenario.otherRole.trim().slice(-1) || "人"}</span><div className="message assistant loading"><small>{scenario.otherRole}</small><p>正在想怎么说<span className="typing-dots" aria-hidden="true">···</span></p></div></div>}</div>
        <div className="composer-area">{directorCue && <div className="director-cue" role="status"><span>{directorCue}</span><button type="button" onClick={() => void leaveConversation(false)}>先停在这里</button></div>}{storageError && <p className="error" role="alert">{storageError}</p>}{safety && <div className="safety" role="alert">{safety}<button onClick={() => setSafety("")}>关闭</button></div>}{error && <p className="error" role="alert">{error}{error.includes("保留") ? "" : "当前记录保留，请重试。"}</p>}
          <form onSubmit={send}><textarea value={draft} onChange={(e) => updateDraftFromKeyboard(e.target.value)} placeholder="你想怎么说，就怎么说…" maxLength={2000} rows={2} disabled={busy || (userTurnCount >= 15 && !pending) || !!pending || (quickDeadline !== null && quickRemaining === 0)} aria-label="你想说的话" /><div className="composer-bottom"><small>只是模拟，你随时可以停下来。</small><VoiceInputButton onText={(text) => setDraft((current) => (current.trim() ? current.trim() + "\n" + text : text).slice(0, 2000))} disabled={busy || !!pending || (quickDeadline !== null && quickRemaining === 0)} /><button className="primary" type="submit" disabled={busy || !draft.trim() || (userTurnCount >= 15 && !pending) || (quickDeadline !== null && quickRemaining === 0)}>{busy ? "等待回应…" : pending ? "重试这句 ↗" : "发出这句 ↗"}</button></div></form>{userTurnCount >= 15 && <p className="muted">这段对话暂时到这里。你可以暂停并回看。</p>}
          <details className="access" open={accessOpen} onToggle={(event) => setAccessOpen(event.currentTarget.open)}>
            <summary>对话接入 <span>{accessKind === "test" ? "项目方测试额度" : "自己的 DeepSeek API"}</span></summary>
            <div className="access-options">{isTestAccount && <label><input type="radio" checked={accessKind === "test"} onChange={() => setAccessKind("test")} /> 项目方测试额度</label>}<label><input type="radio" checked={accessKind === "own_saved"} onChange={() => setAccessKind("own_saved")} /> 我的 DeepSeek API</label></div>
            {accessKind === "test" ? <p className="muted">已使用测试账号登录，无需再次输入暗号。对话仍会保存到当前账号。</p> : <div className="saved-api-settings">
              <p className="muted">{apiSaved ? "API Key 已加密保存到你的账号，以后登录无需再次填写。" : "首次使用时保存一次 API Key，以后登录直接使用。"}</p>
              <div className="two-cols"><label className="field"><span>{apiSaved ? "更换 DeepSeek API Key（可选）" : "DeepSeek API Key"}</span><input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} autoComplete="new-password" maxLength={300} placeholder={apiSaved ? "已保存；留空即可继续使用" : "输入后点击保存"} /></label><label className="field"><span>模型</span><select value={ownModel} onChange={(e) => setOwnModel(e.target.value as typeof ownModel)}><option value="deepseek-flash">deepseek-flash</option><option value="deepseek-v4-pro">deepseek-v4-pro</option></select></label></div>
              <div className="api-settings-actions"><button className="secondary" type="button" onClick={() => void saveOwnKey()} disabled={apiBusy || !apiKey.trim()}>{apiBusy ? "处理中…" : apiSaved ? "更换已保存的 Key" : "保存 API Key"}</button>{apiSaved && <button className="text-button" type="button" onClick={() => void removeOwnKey()} disabled={apiBusy}>移除已保存的 Key</button>}</div>
              {apiError && <p className="error" role="alert">{apiError}</p>}
            </div>}
            <p className="muted">测试暗号只用于登录；个人 API Key 只在保存时提交，之后由服务端使用，不会出现在聊天记录里。</p>
          </details></div>
      </div></section>}

    {step === "landing" && <section className="panel narrow landing">{quickDeadline !== null && quickRemaining === 0 && <p className="auth-notice">五分钟到了。先回到你自己这里。{temporaryMode ? "这段临时对话可回看，但离开后无法找回。" : "如果还想继续，可以从历史记录重新打开这段对话。"}</p>}{temporaryMode && <p className="auth-notice">临时对话没有保存。离开页面后，内容无法找回。</p>}{safety && <div className="safety" role="alert">{safety}</div>}<div className="eyebrow">情绪落地</div><h1>{leftRole ? "现在可以先离开角色。" : "先回到你自己这里。"}</h1><p className="lead">这只是一段模拟。你不需要现在就判断它意味着什么，也不必立刻做出现实决定。</p><div className="landing-actions"><button className="secondary" onClick={() => changeStatus("active")} disabled={quickDeadline !== null && quickRemaining === 0}>继续这段对话</button><button className="secondary" onClick={lowerIntensity} disabled={quickDeadline !== null && quickRemaining === 0}>降低强度后继续</button><button className="secondary" onClick={startPerspective} disabled={(quickDeadline !== null && quickRemaining === 0) || scenario.mode === "perspective" || Boolean(scenario.cast?.length) || !messages.some((message) => message.role === "assistant" && message.emotion !== "系统安全提示")}>交换角色试试</button><button className="secondary" onClick={() => setShowReflection((value) => !value)}>{showReflection ? "收起回看" : "我想回看"}</button></div>{showReflection && <ExpressionPanel messages={messages} typingPauses={typingPauses} />}{showReflection && <div className="reflection"><h2>对话回看</h2><p style={{ whiteSpace: "pre-line" }}>{reflection.text}</p><p>你已经表达了 {userTurnCount} 轮。这里仅展示对话中的候选转折点，不评判谁对谁错。</p>{turningPoints.length ? turningPoints.map((point) => <div className="point-card" key={point.id}><p>“{point.content}”</p>{point.reason && <small>模型识别的变化：{point.reason}</small>}<button className="text-button" onClick={() => rewind(point.id)} disabled={quickDeadline !== null && quickRemaining === 0}>从这里换一种说法 →</button></div>) : <p className="muted">暂未识别到明确转折点；你仍可以回到对话继续表达。</p>}</div>}<label className="field"><span>这段模拟停在了哪里？（由你判断）</span><select value={endingType} onChange={(event) => setEndingType(event.target.value as EndingType)}><option value="exit">我选择先停下</option><option value="cooled">气氛缓和了一些</option><option value="stalemate">暂时僵持</option><option value="escalated">冲突升级</option><option value="broken">关系在模拟中中断</option></select></label><label className="field"><span>结束后，你现在的感受（可选）</span><select value={userFeeling} onChange={(event) => setUserFeeling(event.target.value)}><option value="">暂时说不清</option><option value="轻松一些">轻松一些</option><option value="仍有话没说">仍有话没说</option><option value="有些紧绷">有些紧绷</option><option value="想休息一下">想休息一下</option></select></label>{!temporaryMode && <div className="feedback-box"><h2>这段体验对你怎么样？（可选）</h2><div className="feedback-options">{([["helpful", "有帮助"], ["unrealistic", "不够真实"], ["too_intense", "太激烈"], ["too_mild", "太温和"]] as const).map(([value, label]) => <label key={value}><input type="radio" name="session-feedback" value={value} checked={feedbackType === value} onChange={() => setFeedbackType(value)} disabled={feedbackSaved} />{label}</label>)}</div><textarea aria-label="反馈补充说明" placeholder="想补充什么？可以留空。" value={feedbackDetail} onChange={(event) => setFeedbackDetail(event.target.value)} maxLength={1000} disabled={feedbackSaved} rows={2} /><button className="secondary" type="button" onClick={() => void submitFeedback()} disabled={!feedbackType || feedbackSaved}>{feedbackSaved ? "已收到反馈" : "提交反馈"}</button></div>}{storageError && <p className="error" role="alert">{storageError}</p>}<div className="row"><button className="text-button" onClick={removeCurrent}>删除并离开</button><button className="primary" onClick={() => changeStatus("completed")} disabled={busy}>{temporaryMode ? "删除并离开" : "保存并离开"}</button></div></section>}

    <footer>ERIS · 一种可能性，不是现实预测。若你或他人正处于危险，请联系当地紧急服务或可信任的人。</footer>
  </main>;
}
