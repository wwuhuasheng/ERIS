"use client";

import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { ChatRequest, Message, ModelReply } from "@/lib/chat";
import { blankScenario, fixedScenario, modeLabels, scenarioHints, scenarioSchema, styleLabels, templates, toPerspectiveScenario, type Scenario } from "@/lib/scenario";
import { initialState, stateDescription, type SceneState } from "@/lib/state";
import { authClient, createBranch, createPerspectiveSession, createStoredSession, deleteStoredScenario, listStoredSessions, loadLatestSession, loadStoredSession, persistenceConfigured, setSessionStatus, storeMessage, storeReplyState, updateScenarioIntensity, saveSessionEnding, type StoredSession, type StoredSessionSummary } from "@/lib/persistence";
import { buildReflection } from "@/lib/reflection";

type Step = "welcome" | "create" | "confirm" | "chat" | "landing" | "history";
type Access = ChatRequest["access"];
type Turn = Message & { emotion?: string; move?: string; turningPoint?: boolean; state?: SceneState };

function makeMessage(role: Message["role"], content: string): Turn {
  return { id: crypto.randomUUID(), role, content };
}

function field(label: string, value: string, onChange: (value: string) => void, options?: { long?: boolean; placeholder?: string; required?: boolean; min?: number; max?: number }) {
  return <label className="field"><span>{label}</span>{options?.long
    ? <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={options.placeholder} required={options.required} minLength={options.min} maxLength={options.max} rows={3} />
    : <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={options?.placeholder} required={options?.required} minLength={options?.min} maxLength={options?.max} />}</label>;
}

type AuthStatus = "loading" | "guest" | "ready" | "unconfigured";
type AuthMode = "login" | "register";

export default function HomePage() {
  const [authStatus, setAuthStatus] = useState<AuthStatus>("loading");
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
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
    if (authMode === "register" && password !== confirmPassword) {
      setAuthError("两次输入的密码不一致。");
      return;
    }
    setAuthBusy(true);
    setAuthError("");
    setAuthNotice("");
    try {
      const db = authClient();
      if (authMode === "register") {
        const { data, error } = await db.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        setPassword("");
        setConfirmPassword("");
        if (!data.session) {
          setAuthMode("login");
          setAuthNotice("注册申请已提交。请查收验证邮件，确认后返回登录。");
        } else if (data.user && !data.user.is_anonymous) {
          setUser(data.user);
          setAuthStatus("ready");
        }
      } else {
        const { data, error } = await db.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        setPassword("");
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
    return <Experience key={user.id} userEmail={user.email || "已登录"} onSignOut={signOut} />;
  }

  return <main className="shell">
    <header className="site-header"><Link className="brand" href="/">✳ <span>ERIS</span></Link><span className="header-note">给未说出口的话，一个可重来的空间</span><span className="phase">账号入口</span></header>
    <section className="panel narrow auth-panel">
      <div className="eyebrow">WELCOME TO ERIS</div>
      {authStatus === "loading" ? <><h1>正在确认账号…</h1><p className="muted">请稍候。</p></> :
        authStatus === "unconfigured" ? <><h1>先连接账号服务</h1><p className="lead">正式注册和个人历史记录需要 Supabase。请先在 .env.local 中填写 NEXT_PUBLIC_SUPABASE_URL 与 NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY，然后重启应用。</p><Link className="text-button" href="/about">查看简介 →</Link></> :
        <><h1>{authMode === "login" ? "欢迎回来。" : "创建你的账号。"}</h1><p className="lead">登录后，你可以选择使用项目测试账号或自己的 DeepSeek API。对话历史会保存在你的账号下。</p>
          <div className="auth-tabs"><button type="button" aria-pressed={authMode === "login"} onClick={() => { setAuthMode("login"); setAuthError(""); setAuthNotice(""); }}>登录</button><button type="button" aria-pressed={authMode === "register"} onClick={() => { setAuthMode("register"); setAuthError(""); setAuthNotice(""); }}>注册</button></div>
          <form className="scenario-form" onSubmit={submitAuth}>
            <label className="field"><span>邮箱</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required /></label>
            <label className="field"><span>密码</span><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={authMode === "login" ? "current-password" : "new-password"} minLength={authMode === "register" ? 8 : undefined} required /></label>
            {authMode === "register" && <label className="field"><span>确认密码</span><input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" minLength={8} required /></label>}
            {authError && <p className="error" role="alert">{authError}</p>}
            {authNotice && <p className="auth-notice" role="status">{authNotice}</p>}
            <button className="primary" disabled={authBusy}>{authBusy ? "请稍候…" : authMode === "login" ? "登录并继续 →" : "注册账号 →"}</button>
          </form><Link className="text-button auth-about" href="/about">先看简介 →</Link></>}
    </section>
    <footer>ERIS · 一种可能性，不是现实预测。若你或他人正处于危险，请联系当地紧急服务或可信任的人。</footer>
  </main>;
}

function Experience({ userEmail, onSignOut }: { userEmail: string; onSignOut: () => Promise<void> }) {
  const [step, setStep] = useState<Step>("welcome");
  const [scenario, setScenario] = useState<Scenario>(fixedScenario);
  const scenarioDrafts = useRef<Partial<Record<Scenario["template"], Scenario>>>({});
  const scenarioBeforeEdit = useRef<Scenario | null>(null);
  const [editingSession, setEditingSession] = useState(false);
  const [accessKind, setAccessKind] = useState<Access["kind"]>("test");
  const [username, setUsername] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [accessOpen, setAccessOpen] = useState(true);
  const [apiKey, setApiKey] = useState("");
  const [ownModel, setOwnModel] = useState<"deepseek-flash" | "deepseek-v4-pro">("deepseek-flash");
  const [messages, setMessages] = useState<Turn[]>([]);
  const [sceneState, setSceneState] = useState<SceneState>(initialState);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [safety, setSafety] = useState("");
  const [formError, setFormError] = useState("");
  const [showReflection, setShowReflection] = useState(false);
  const [scenarioId, setScenarioId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [pending, setPending] = useState<Turn | null>(null);
  const [storageError, setStorageError] = useState("");
  const [userFeeling, setUserFeeling] = useState("");
  const [historyEntries, setHistoryEntries] = useState<StoredSessionSummary[]>([]);
  const [selectedHistory, setSelectedHistory] = useState<StoredSession | null>(null);
  const [historyBusy, setHistoryBusy] = useState(false);
  const stepBeforeHistory = useRef<Step>("welcome");

  useEffect(() => {
    if (!persistenceConfigured()) return;
    let cancelled = false;
    loadLatestSession().then((stored) => {
      if (cancelled || !stored) return;
      setScenario(stored.scenario);
      setScenarioId(stored.scenarioId);
      setSessionId(stored.sessionId);
      setMessages(stored.messages);
      setSceneState(stored.state);
      const last = stored.messages.at(-1);
      if (last?.role === "user") { setPending(last); setDraft(last.content); }
      setStep((current) => current === "history" ? current : stored.status === "paused" ? "landing" : "chat");
    }).catch((cause) => { if (!cancelled) setStorageError(cause instanceof Error ? cause.message : "无法恢复上次的对话。"); });
    return () => { cancelled = true; };
  }, []);

  const userTurnCount = messages.filter((message) => message.role === "user").length;
  const turningPoints = messages.filter((message) => message.turningPoint && message.role === "assistant").slice(0, 3);
  const reflection = buildReflection(messages);

  function updateScenario<K extends keyof Scenario>(key: K, value: Scenario[K]) {
    setScenario((previous) => ({ ...previous, [key]: value }));
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
    setFormError("");
    setStorageError("");
    setStep("create");
  }

  function editScenario() {
    scenarioBeforeEdit.current = scenario;
    scenarioDrafts.current = { [scenario.template]: scenario };
    setEditingSession(true);
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

  async function begin() {
    if (editingSession && (messages.length > 0 || draft.trim()) && !window.confirm("修改场景会开始一段新对话。若未配置 Supabase，当前页面中的旧对话将无法恢复。继续吗？")) return;
    if (persistenceConfigured()) {
      try {
        const stored = await createStoredSession(scenario);
        setScenarioId(stored.scenarioId);
        setSessionId(stored.sessionId);
        setStorageError("");
      } catch (cause) {
        setStorageError(cause instanceof Error ? cause.message : "无法保存场景，请检查 Supabase 配置。");
        return;
      }
    } else { setScenarioId(null); setSessionId(null); }
    setPending(null);
    setMessages([]);
    setSceneState(initialState);
    setDraft("");
    setError("");
    setSafety("");
    setShowReflection(false);
    setUserFeeling("");
    setEditingSession(false);
    setStep("chat");
  }

  function validateScenario(event: FormEvent) {
    event.preventDefault();
    const result = scenarioSchema.safeParse(scenario);
    if (!result.success) {
      const labels: Record<keyof Scenario, string> = {
        template: "场景模板", title: "情境名字", background: "发生了什么", userRole: "你的身份",
        otherRole: "对方身份", relationship: "你们的关系", otherPosition: "对方立场",
        userGoal: "你的目标", userConcern: "你的担忧", unsaidWords: "没说出口的话",
        excludedTopics: "不希望涉及的内容", style: "对方风格", intensity: "模拟强度", mode: "交互模式",
      };
      const first = result.error.issues[0];
      setFormError(`请检查「${labels[first.path[0] as keyof Scenario] || "场景内容"}」：${first.code === "too_small" ? "内容太短" : first.code === "too_big" ? "内容太长" : "格式不正确"}。`);
      return;
    }
    setFormError("");
    setStep("confirm");
  }

  async function send(event: FormEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || busy || (userTurnCount >= 15 && !pending)) return;
    const access: Access = accessKind === "test"
      ? { kind: "test", username: username.trim(), passphrase }
      : { kind: "own", apiKey: apiKey.trim(), model: ownModel };
    if (access.kind === "test" && (!access.username || !access.passphrase)) {
      setAccessOpen(true);
      setError("请输入测试账号和暗号，或切换为自己的 API。");
      return;
    }
    if (access.kind === "own" && !access.apiKey) {
      setAccessOpen(true);
      setError("请填写你的 DeepSeek API Key。");
      return;
    }
    const userMessage = pending || makeMessage("user", text);
    const nextMessages = pending ? messages : [...messages, userMessage];
    setBusy(true);
    setError("");
    try {
      if (sessionId && !pending) {
        await storeMessage(sessionId, userMessage, messages.length);
        setPending(userMessage);
        setMessages(nextMessages);
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
        setMessages([...nextMessages, notice]);
        setSafety(result.message);
        setPending(null);
        setDraft("");
        if (sessionId) {
          try {
            await storeMessage(sessionId, notice, nextMessages.length);
            await storeReplyState(sessionId, notice.id, sceneState, "安全中止普通模拟", false);
            await setSessionStatus(sessionId, "paused");
          } catch (cause) { setStorageError(cause instanceof Error ? cause.message : "安全提示保存失败。"); }
        }
        setStep("landing");
        return;
      }
      const reply = result as ModelReply & { state: SceneState };
      const assistantMessage: Turn = { ...makeMessage("assistant", reply.reply), emotion: reply.visible_emotion, move: reply.conflict_move, turningPoint: reply.turning_point_candidate, state: reply.state };
      setMessages([...nextMessages, assistantMessage]);
      setSceneState(reply.state);
      setAccessOpen(false);
      setPending(null);
      setDraft("");
      if (sessionId) {
        try {
          await storeMessage(sessionId, assistantMessage, nextMessages.length);
          await storeReplyState(sessionId, assistantMessage.id, reply.state, reply.change_reason, reply.turning_point_candidate);
        } catch (cause) {
          setStorageError(cause instanceof Error ? `回复已显示，但保存失败：${cause.message}` : "回复已显示，但保存失败。");
        }
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "请求失败，请重试。");
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
        await createBranch(sessionId, scenarioId, pointId, priorMessages, priorState, scenario.mode);
        const branch = await loadLatestSession();
        if (branch) { setSessionId(branch.sessionId); setMessages(branch.messages); }
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
  }

  async function startPerspective() {
    if (scenario.mode === "perspective") return;
    const point = turningPoints.at(-1) || messages.filter((message) => message.role === "assistant" && message.emotion !== "系统安全提示").at(-1);
    if (!point) return;
    const index = messages.findIndex((message) => message.id === point.id);
    const spoken = messages.slice(0, index);
    const priorState = [...spoken].reverse().find((message) => message.state)?.state || initialState;
    const swapped = spoken.map((message) => ({ ...message, role: message.role === "user" ? "assistant" as const : "user" as const }));
    if (sessionId && scenarioId) {
      try {
        await createPerspectiveSession(sessionId, scenarioId, point.id, spoken, priorState);
        const branch = await loadLatestSession();
        if (!branch) throw new Error("无法读取换位会话。");
        setSessionId(branch.sessionId);
        setMessages(branch.messages);
        setScenario(branch.scenario);
      } catch (cause) { setStorageError(cause instanceof Error ? cause.message : "换位会话创建失败。"); return; }
    } else { setMessages(swapped); setScenario(toPerspectiveScenario(scenario)); }
    setSceneState(priorState);
    setDraft("");
    setPending(null);
    setSafety("");
    setShowReflection(false);
    setStep("chat");
  }

  async function removeCurrent() {
    if (!window.confirm("确定永久删除这段场景和所有分支记录吗？此操作无法撤销。")) return;
    try {
      if (scenarioId) await deleteStoredScenario(scenarioId);
      setMessages([]); setPending(null); setScenarioId(null); setSessionId(null); setDraft(""); setStep("welcome");
    } catch (cause) { setStorageError(cause instanceof Error ? cause.message : "删除失败。"); }
  }

  async function lowerIntensity() {
    try {
      if (scenarioId) await updateScenarioIntensity(scenarioId, 1);
      updateScenario("intensity", 1);
      await changeStatus("active");
    } catch (cause) { setStorageError(cause instanceof Error ? cause.message : "强度调整失败。"); }
  }

  async function changeStatus(status: "active" | "paused" | "completed") {
    if (sessionId) {
      try {
        if (status === "completed") await saveSessionEnding(sessionId, reflection.coreExpression, reflection.peakMoment, showReflection ? reflection.text : null, userFeeling);
        await setSessionStatus(sessionId, status);
      } catch (cause) { setStorageError(cause instanceof Error ? cause.message : "保存会话状态失败。"); return; }
    }
    setStep(status === "active" ? "chat" : status === "paused" ? "landing" : "welcome");
  }

  async function openHistory() {
    if (step === "history") return;
    stepBeforeHistory.current = step;
    setSelectedHistory(null);
    setHistoryBusy(true);
    setStorageError("");
    setStep("history");
    try {
      setHistoryEntries(await listStoredSessions());
    } catch (cause) {
      setStorageError(cause instanceof Error ? cause.message : "历史记录读取失败。");
    } finally {
      setHistoryBusy(false);
    }
  }

  async function viewHistory(sessionId: string) {
    setHistoryBusy(true);
    setStorageError("");
    try {
      const stored = await loadStoredSession(sessionId);
      if (!stored) throw new Error("这段记录不存在或你没有查看权限。");
      setSelectedHistory(stored);
    } catch (cause) {
      setStorageError(cause instanceof Error ? cause.message : "对话读取失败。");
    } finally {
      setHistoryBusy(false);
    }
  }

  return <main className="shell">
    <header className="site-header"><button className="brand" onClick={() => setStep("welcome")}>✳ <span>ERIS</span></button><span className="header-note">给未说出口的话，一个可重来的空间</span><div className="header-actions"><button type="button" onClick={() => void openHistory()}>历史记录</button><span className="account-email" title={userEmail}>{userEmail}</span><button type="button" onClick={() => void onSignOut()}>退出</button></div></header>

    {step === "welcome" && <section className="hero">{storageError && <p className="error" role="alert">{storageError}</p>}
      <div className="eyebrow">RELATIONSHIP SIMULATION · 关系情境模拟</div>
      <h1>那些没能说出口的话，<br /><em>可以先在这里说。</em></h1>
      <p>与拥有自己立场的虚构角色进行一段困难对话。你可以表达、争辩、暂停，也可以试试另一种说法。</p>
      <div className="hero-actions"><button className="primary" onClick={() => { setScenario(fixedScenario); setEditingSession(false); setStep("confirm"); }}>试试固定场景 <span>→</span></button><button className="secondary" onClick={createScenario}>创建我的场景</button></div>
      <Link href="/about" className="intro-link"><span>简介</span><span aria-hidden="true">→</span></Link>
      <p className="disclaimer">这是 AI 生成的可能情境，不代表现实人物的想法，也不提供心理诊断或治疗。</p>
    </section>}

    {step === "history" && <section className="panel narrow history-panel">
      <div className="eyebrow">MY CONVERSATIONS · 我的记录</div>
      <h1>{selectedHistory ? selectedHistory.scenario.title : "历史对话"}</h1>
      <p className="muted">这里显示当前账号最近 50 段对话。只有这个账号可以读取自己的记录。</p>
      {storageError && <p className="error" role="alert">{storageError}</p>}
      {historyBusy ? <p className="muted">正在读取…</p> : selectedHistory ?
        <div className="history-transcript">{selectedHistory.messages.length ? selectedHistory.messages.map((message) => <div className={"history-message " + message.role} key={message.id}><small>{message.role === "user" ? "你" : selectedHistory.scenario.otherRole}</small><p>{message.content}</p></div>) : <p className="muted">这段对话还没有消息。</p>}</div> :
        historyEntries.length ? <div className="history-list">{historyEntries.map((item) => <button type="button" key={item.id} onClick={() => void viewHistory(item.id)}><span><strong>{item.title}</strong><small>{new Date(item.createdAt).toLocaleString("zh-CN")} · {item.status === "active" ? "进行中" : item.status === "paused" ? "已暂停" : "已完成"}</small></span><span aria-hidden="true">→</span></button>)}</div> :
          <p className="muted">还没有历史记录。开始一段对话后，这里会出现你的记录。</p>}
      <div className="row"><button className="text-button" type="button" onClick={() => selectedHistory ? setSelectedHistory(null) : setStep(stepBeforeHistory.current)}>← {selectedHistory ? "返回记录列表" : "返回"}</button></div>
    </section>}

    {step === "create" && <section className="panel narrow"><div className="eyebrow">01 / {editingSession ? "修改场景" : "创建场景"}</div><h1>把你的情境，写成一段可探索的对话。</h1><p className="muted">选择模板后填写自己的故事；切换模板会保留各自的草稿。请勿输入身份证号、住址等敏感资料。</p>
      {storageError && <p className="error" role="alert">{storageError}</p>}<form onSubmit={validateScenario} className="scenario-form">
        <label className="field"><span>场景模板</span><select value={scenario.template} onChange={(e) => chooseTemplate(e.target.value as Scenario["template"])}>{Object.entries(templates).map(([id, item]) => <option key={id} value={id}>{item.label} · {item.description}</option>)}</select></label>
        {field("给这段情境起个名字", scenario.title, (v) => updateScenario("title", v), { required: true, min: 2, max: 80, placeholder: scenarioHints[scenario.template].title })}
        {field("发生了什么？", scenario.background, (v) => updateScenario("background", v), { long: true, required: true, min: 10, max: 1200, placeholder: scenarioHints[scenario.template].background })}
        <div className="two-cols">{field("你在其中的身份", scenario.userRole, (v) => updateScenario("userRole", v), { required: true, min: 1, max: 80, placeholder: scenarioHints[scenario.template].userRole })}{field("对方的身份", scenario.otherRole, (v) => updateScenario("otherRole", v), { required: true, min: 1, max: 80, placeholder: scenarioHints[scenario.template].otherRole })}</div>
        {field("你们的关系", scenario.relationship, (v) => updateScenario("relationship", v), { required: true, min: 2, max: 120, placeholder: scenarioHints[scenario.template].relationship })}
        {field("对方可能坚持什么立场？", scenario.otherPosition, (v) => updateScenario("otherPosition", v), { long: true, required: true, min: 2, max: 500, placeholder: scenarioHints[scenario.template].otherPosition })}
        {field("你希望说清楚什么？", scenario.userGoal, (v) => updateScenario("userGoal", v), { long: true, required: true, min: 2, max: 500, placeholder: scenarioHints[scenario.template].userGoal })}
        {field("你最担心什么？", scenario.userConcern, (v) => updateScenario("userConcern", v), { long: true, max: 500 })}
        {field("还没说出口的话（可选）", scenario.unsaidWords, (v) => updateScenario("unsaidWords", v), { long: true, max: 1000 })}
        {field("不希望涉及的内容（可选）", scenario.excludedTopics, (v) => updateScenario("excludedTopics", v), { max: 500 })}
        <div className="two-cols"><label className="field"><span>对方风格</span><select value={scenario.style} onChange={(e) => updateScenario("style", e.target.value as Scenario["style"])}>{Object.entries(styleLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="field"><span>模拟强度</span><select value={scenario.intensity} onChange={(e) => updateScenario("intensity", Number(e.target.value))}><option value={1}>轻 · 保留余地</option><option value={2}>中 · 有分歧</option><option value={3}>强 · 更直接</option></select></label></div>
        <label className="field"><span>交互模式</span><select value={scenario.mode} onChange={(e) => updateScenario("mode", e.target.value as Scenario["mode"])}>{Object.entries(modeLabels).filter(([value]) => value !== "perspective").map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        {formError && <p className="error">{formError}</p>}
        <div className="row"><button type="button" className="text-button" onClick={cancelScenarioEdit}>← {editingSession ? "取消修改" : "返回"}</button><button className="primary">确认场景 →</button></div>
      </form>
    </section>}

    {step === "confirm" && <section className="panel narrow"><div className="eyebrow">02 / 场景确认</div><h1>{scenario.title}</h1><p className="lead">{scenario.background}</p><div className="summary-grid"><div><small>你们的关系</small><strong>{scenario.relationship}</strong></div><div><small>对方立场</small><strong>{scenario.otherPosition}</strong></div><div><small>你的目标</small><strong>{scenario.userGoal}</strong></div><div><small>模拟设定</small><strong>{styleLabels[scenario.style]} · {modeLabels[scenario.mode]} · 强度 {scenario.intensity}</strong></div></div><p className="muted">对方不会直接知道你尚未说出口的话和内心担忧。模拟不是现实预测。</p>{storageError && <p className="error" role="alert">{storageError}</p>}<div className="row"><button className="text-button" onClick={() => setStep("create")}>← 修改场景</button><button className="primary" onClick={begin}>{editingSession ? "应用更改，开始新对话 →" : "进入对话 →"}</button></div></section>}

    {step === "chat" && <section className="chat-layout"><aside className="chat-sidebar"><details className="scene-note"><summary><span className="eyebrow">这段情境</span><strong>{scenario.title}</strong></summary><p>{scenario.background}</p><p className="scene-status">{modeLabels[scenario.mode]} · 第 {userTurnCount} / 15 轮 · {stateDescription(sceneState)}</p><div className="scene-controls"><label className="field"><span>对话强度</span><select value={scenario.intensity} onChange={(e) => updateScenario("intensity", Number(e.target.value))}><option value={1}>轻 · 保留余地</option><option value={2}>中 · 有分歧</option><option value={3}>强 · 更直接</option></select></label><div className="scene-controls-actions"><button className="text-button" onClick={editScenario}>编辑场景</button><button className="text-button" onClick={removeCurrent}>删除这段对话</button></div></div></details></aside>
      <div className="chat-main"><div className="chat-top"><div className="chat-persona"><span className="avatar" aria-hidden="true">{scenario.otherRole.trim().slice(-1) || "人"}</span><div><strong>{scenario.otherRole}</strong><span>一段可能发生的对话</span></div></div><button className="pause-button" onClick={() => changeStatus("paused")}>暂停对话</button></div>
        <div className="messages" aria-live="polite">{messages.length === 0 && <div className="opening"><span className="opening-mark">✳</span><p>从你想说的那句话开始。</p><span>{scenario.otherRole} 会以自己的立场回应。你不必把话说得很完整。</span></div>}{messages.map((message) => <div className={"message-row " + message.role} key={message.id}>{message.role === "assistant" && <span className="message-avatar" aria-hidden="true">{scenario.otherRole.trim().slice(-1) || "人"}</span>}<div className={"message " + message.role}><small>{message.role === "user" ? "你" : scenario.otherRole}</small><p>{message.content}</p></div></div>)}{busy && <div className="message-row assistant"><span className="message-avatar" aria-hidden="true">{scenario.otherRole.trim().slice(-1) || "人"}</span><div className="message assistant loading"><small>{scenario.otherRole}</small><p>正在想怎么说<span className="typing-dots" aria-hidden="true">···</span></p></div></div>}</div>
        <div className="composer-area">{storageError && <p className="error" role="alert">{storageError}</p>}{safety && <div className="safety" role="alert">{safety}<button onClick={() => setSafety("")}>关闭</button></div>}{error && <p className="error" role="alert">{error}{error.includes("保留") ? "" : "当前记录保留，请重试。"}</p>}
          <form onSubmit={send}><textarea value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="你想怎么说，就怎么说…" maxLength={2000} rows={2} disabled={busy || (userTurnCount >= 15 && !pending) || !!pending} aria-label="你想说的话" /><div className="composer-bottom"><small>只是模拟，你随时可以停下来。</small><button className="primary" type="submit" disabled={busy || !draft.trim() || (userTurnCount >= 15 && !pending)}>{busy ? "等待回应…" : pending ? "重试这句 ↗" : "发出这句 ↗"}</button></div></form>{userTurnCount >= 15 && <p className="muted">这段对话暂时到这里。你可以暂停并回看。</p>}
          <details className="access" open={accessOpen} onToggle={(event) => setAccessOpen(event.currentTarget.open)}><summary>对话接入 <span>{accessKind === "test" ? "固定测试账号" : "自己的 DeepSeek API"}</span></summary><div className="access-options"><label><input type="radio" checked={accessKind === "test"} onChange={() => setAccessKind("test")} /> 固定测试账号</label><label><input type="radio" checked={accessKind === "own"} onChange={() => setAccessKind("own")} /> 自行配置 DeepSeek API</label></div>{accessKind === "test" ? <div className="two-cols">{field("测试账号", username, setUsername, { max: 100 })}<label className="field"><span>测试暗号</span><input type="password" value={passphrase} onChange={(e) => setPassphrase(e.target.value)} autoComplete="off" maxLength={200} /></label></div> : <div className="two-cols"><label className="field"><span>DeepSeek API Key</span><input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} autoComplete="off" /></label><label className="field"><span>模型</span><select value={ownModel} onChange={(e) => setOwnModel(e.target.value as typeof ownModel)}><option value="deepseek-flash">deepseek-flash</option><option value="deepseek-v4-pro">deepseek-v4-pro</option></select></label></div>}<p className="muted">凭据仅用于这次对话，不会保存在页面记录里。</p></details></div>
      </div></section>}

    {step === "landing" && <section className="panel narrow landing">{safety && <div className="safety" role="alert">{safety}</div>}<div className="eyebrow">情绪落地</div><h1>先回到你自己这里。</h1><p className="lead">这只是一段模拟。你不需要现在就判断它意味着什么，也不必立刻做出现实决定。</p><div className="landing-actions"><button className="secondary" onClick={() => changeStatus("active")}>继续这段对话</button><button className="secondary" onClick={lowerIntensity}>降低强度后继续</button><button className="secondary" onClick={startPerspective} disabled={scenario.mode === "perspective" || !messages.some((message) => message.role === "assistant" && message.emotion !== "系统安全提示")}>交换角色试试</button><button className="secondary" onClick={() => setShowReflection((value) => !value)}>{showReflection ? "收起回看" : "我想回看"}</button></div>{showReflection && <div className="reflection"><h2>对话回看</h2><p style={{ whiteSpace: "pre-line" }}>{reflection.text}</p><p>你已经表达了 {userTurnCount} 轮。这里仅展示对话中的候选转折点，不评判谁对谁错。</p>{turningPoints.length ? turningPoints.map((point) => <div className="point-card" key={point.id}><p>“{point.content}”</p><button className="text-button" onClick={() => rewind(point.id)}>从这里换一种说法 →</button></div>) : <p className="muted">暂未识别到明确转折点；你仍可以回到对话继续表达。</p>}</div>}<label className="field"><span>结束后，你现在的感受（可选）</span><select value={userFeeling} onChange={(event) => setUserFeeling(event.target.value)}><option value="">暂时说不清</option><option value="轻松一些">轻松一些</option><option value="仍有话没说">仍有话没说</option><option value="有些紧绷">有些紧绷</option><option value="想休息一下">想休息一下</option></select></label>{storageError && <p className="error" role="alert">{storageError}</p>}<div className="row"><button className="text-button" onClick={removeCurrent}>删除并离开</button><button className="primary" onClick={() => changeStatus("completed")}>完成</button></div></section>}

    <footer>ERIS · 一种可能性，不是现实预测。若你或他人正处于危险，请联系当地紧急服务或可信任的人。</footer>
  </main>;
}
