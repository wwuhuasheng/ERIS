# ERIS

> 给那些尚未说出口的话，一个可重来的情境空间。

ERIS 是一款面向情绪表达、关系冲突与困难沟通的 AI 情境模拟作品。用户可以描述一段经历或设想的情境，与有自身立场的虚构角色对话，试着表达、争辩、暂停、降低强度，或从关键处换一种说法。

它生成的是**一种可能的对话**，不是现实人物的真实想法、心理诊断，也不是关系走向的预测。

## 作品价值

- 为现实中来不及说、难以说出口的话提供私密的练习空间。
- 让困难沟通不止于“得到建议”：角色有自己的立场、误解和边界。
- 允许用户探索分歧与不同走向，而不替用户判断谁对谁错。
- 用互动叙事呈现关系的复杂性，同时把暂停与退出权留给用户。

## 产品体验

首页可直接进入“好友反复失约”的固定场景，也可从空白草稿创建友情、恋爱关系、人情边界或职场沟通场景。不同模板提供对应的填写提示，切换时保留各自草稿。场景包含双方身份、关系、对方立场、用户目标、担忧、禁止内容、沟通风格、模拟强度和模式。确认后可进行至多 15 轮文字对话；进入对话后仍可编辑场景并从新设定开始一段新对话。模型回复包含可见情绪、冲突动作、状态变化建议和转折点信号；服务端校验格式并限制单轮状态变化。

聊天页以角色台词为主，场景状态和操作收在可展开的情境区，不把内部情绪标签或导演信号直接展示在气泡里。服务端会为所有场景注入[自然对话提示模块](lib/voice-skill.ts)：依据关系类型调整语感，要求角色接住上一句、保持自己的立场、避免客服式套话和无端劝和。这是可复用的提示词模板与回归测试，**不是模型微调**；实际效果仍需用真实对话持续评估。

结束前先进入情绪落地页，回看由用户主动打开；不做统一评分。若配置 Supabase，场景、消息、状态与转折点会保存到按用户隔离的数据库，刷新后可恢复，删除场景会级联删除相关记录。未配置 Supabase 时仅保存在当前页面内存中。

## 两种模型接入方式

| 入口 | 使用方式 | 费用与质量控制 |
|---|---|---|
| 固定测试账号 | 受邀测试者输入预设账号和暗号，无需提供 API Key | 服务端使用项目方的 DeepSeek Key 和指定模型；项目方承担费用并统一测试基线。 |
| 自行配置 | 用户在当前页面输入自己的 DeepSeek API Key，选择模型 | 使用用户的 DeepSeek 账号；不同模型可能带来不同效果。Key 不持久保存。 |

两条路径都通过 Next.js 服务端接口调用 [DeepSeek Responses API](https://api-docs.deepseek.com/guides/responses_api/)，请求地址固定为 `https://api.deepseek.com`，不会调用 OpenAI 服务。默认模型是 `deepseek-flash`；自带 Key 可在页面选择 `deepseek-v4-pro`。模型输出使用结构化 JSON 格式并在服务端验证；若连续两次格式异常，会明确提示重试并保留输入，不再把固定兜底文案当成角色回复。开发环境中测试入口使用进程内每日总额度；生产环境必须配置 Supabase 服务端 secret key 和数据库额度函数，才能使用项目方测试额度。即使启用数据库总额度，公开发布前仍需完成访问控制与实测。

## 技术栈

- Next.js App Router、React、TypeScript、原生 CSS。
- Route Handler 服务端调用 DeepSeek；Zod 校验用户输入与模型 JSON 输出；纯函数限制情境状态变化。
- Supabase PostgreSQL、匿名 Auth 与 RLS（可选配置；用于受控测试）；数据库原子计数限制项目方测试额度。
- Vitest 单元测试；旧版 Streamlit/Python 原型保留在仓库，便于对照验证。

## 本地运行

需要 Node.js 20.9 或更新版本。执行：

```bash
npm ci
cp .env.example .env.local
npm run dev
```

打开 `http://localhost:3000`。若只用自己的 DeepSeek Key，可不填写服务端 `DEEPSEEK_API_KEY`。若要启用固定测试账号，在 `.env.local` 中设置 `ERIS_TEST_USERNAME`、`ERIS_TEST_PASSPHRASE`、`DEEPSEEK_API_KEY`，按需设置 `DEEPSEEK_MODEL` 和 `ERIS_TEST_DAILY_LIMIT`。不要把真实密钥或暗号提交到 GitHub。

需要保存和恢复对话时，创建自己的 Supabase 项目，在 Supabase Auth 中启用匿名登录，并依次执行 [初始数据库迁移](supabase/migrations/202611050001_initial.sql) 和 [测试额度迁移](supabase/migrations/202611050002_quota.sql)。随后将项目 URL 和 publishable key 写入 `.env.local` 的 `NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`。这里的 publishable key 可以出现在浏览器中；**绝不能填 service_role/secret key**。匿名账号依赖当前浏览器的登录信息，清理浏览器数据后可能无法找回原有记录。生产环境若要开放固定测试账号，还须在服务端设置 `SUPABASE_URL` 与 `SUPABASE_SECRET_KEY`；secret key 只能放在服务端，不能加 `NEXT_PUBLIC_` 前缀。

验证代码：

```bash
npm run typecheck
npm test
npm run build
```

Python 原型仍可使用 `python3.12 -m venv .venv && source .venv/bin/activate && pip install -e . && streamlit run app.py` 独立启动；它不是正式 Web 应用入口。

## 安全与边界

ERIS 不预测现实人物，不提供心理治疗、诊断或操纵他人的话术。用户可暂停、降低强度、结束和删除；遇到自伤、现实暴力或立即危险时应停止普通角色模拟，并联系当地紧急服务或可信任的人。请勿输入不必要的私人敏感资料。

当前仓库提供受控测试所需的代码与数据库迁移；真实 DeepSeek 调用、Supabase 连接和数据库权限仍需在你自己的项目环境中配置并实测，不能凭本地构建通过就视为已完成公开上线验收。
