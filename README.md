# ERIS

> 给那些尚未说出口的话，一个可重来的情境空间。

ERIS 是一款面向个人用户的情绪表达、关系冲突与困难沟通 AI 情境模拟作品。用户可以描述一段经历或设想的情境，与有自身立场的虚构角色对话，试着表达、争辩、暂停、降低强度，或从关键处换一种说法。

它生成的是**一种可能的对话**，不是现实人物的真实想法、心理诊断，也不是关系走向的预测。

了解当前版本：[产品与功能概览](ERIS项目书.md) · [已实现功能清单](docs/已实现功能清单.md)。

## 作品价值

- 为现实中来不及说、难以说出口的话提供私密的练习空间。
- 让困难沟通不止于“得到建议”：角色有自己的立场、误解和边界。
- 允许用户探索分歧与不同走向，而不替用户判断谁对谁错。
- 用互动叙事呈现关系的复杂性，同时把暂停与退出权留给用户。

## 产品体验

登录后，选择固定场景、快捷宣泄或自建场景，与有自身立场的虚构角色对话。你可以调整强度、暂停或结束，也可以使用语音输入和自定义表情。

对话可保存并继续；结束后可回看转折点、重试不同走向或换位体验。不想留下历史时，可选择“用完即删”。

## 创作者模式与模板

创作者账号从独立的 /creator 页面注册或登录，普通登录页保留手机号和固定测试账号。创作者使用独立用户名和密码；测试账号的登录方式和项目方 API 不变。创作者账号的对话记录、已保存的个人 DeepSeek API Key 和私有模板都绑定在同一个 Supabase Auth 用户 ID 下。创作者可创建、编辑、删除模板，也可将 ERIS 场景 JSON 导入自己的模板库；模板不会自动发布到公共场景列表。模板保存时会清空担忧、没说出口的话、可控记忆和头像。固定场景及个人模板都会先进入可编辑表单，微调后再开始对话。

新部署还需应用[创作者模板迁移](supabase/migrations/20261117151646_creator_templates.sql)。当前连接的 Supabase 项目已经可查询 `creator_templates` 表；创作者模板的写入和跨账号隔离仍需用真实创作者账号验收。新账号不会自动继承其他账号的历史或 API Key；场景可通过 JSON 导入导出。

## 两种模型接入方式

普通用户用手机号和密码注册登录，登录后首次保存自己的 DeepSeek API Key；固定测试账号和暗号可在登录页直接使用，登录后自动使用服务端配置的项目方 DeepSeek API；页面不再展示测试额度切换选项，也无需再次输入暗号。测试账号本身预先建立在 Supabase Auth 中，其密码由 Auth 安全处理，项目方 API Key 始终留在服务端。两类账号的历史按用户 ID 隔离。

| 入口 | 使用方式 | 费用与质量控制 |
|---|---|---|
| 固定测试账号 | 在登录页输入预设账号和暗号，无需提供 API Key | 只有 Auth 中被标记为测试账号的用户可用项目方 DeepSeek Key；项目方承担费用并统一测试基线。 |
| 自行配置 | 登录后首次保存自己的 DeepSeek API Key，以后直接选择模型并使用 | 使用用户的 DeepSeek 账号；Key 由服务端加密保存在账号下，不显示在历史记录中，可更换或移除。 |

两条路径都通过 Next.js 服务端接口调用 [DeepSeek Responses API](https://api-docs.deepseek.com/guides/responses_api/)，请求地址固定为 `https://api.deepseek.com`，不会调用 OpenAI 服务。默认模型是 `deepseek-flash`；自带 Key 可在页面选择 `deepseek-v4-pro`。模型输出使用结构化 JSON 格式并在服务端验证；若格式修复和重新生成后仍异常，会明确提示重试并保留输入，不再把固定兜底文案当成角色回复。多轮回复会额外检查角色视角，发现串位时尝试重写。测试账号用 DeepSeek V4 Pro 检查；自带 Key 使用页面所选模型检查。这会增加相应 API 的请求量、费用和等待时间。开发环境中测试入口使用进程内每日总额度；生产环境必须配置 Supabase 服务端 secret key 和数据库额度函数，才能使用项目方测试额度。即使启用数据库总额度，公开发布前仍需完成访问控制与实测。

## 技术栈

- Next.js App Router、React、TypeScript、原生 CSS。
- Route Handler 服务端调用 DeepSeek；Zod 校验用户输入与模型 JSON 输出；纯函数限制情境状态变化。
- Supabase PostgreSQL、密码 Auth 与 RLS（运行必需）；数据库原子计数限制项目方测试额度。普通手机号通过内部别名邮箱映射到 Auth 用户，不进行手机号验证。
- Vitest 单元测试；旧版 Streamlit/Python 原型保留在仓库，便于对照验证。

## 本地运行

需要 Node.js 20.9 或更新版本。执行：

```bash
npm ci
cp .env.example .env.local
```

先在自己的 Supabase 项目中保持 Email/Password Auth 可用，并按顺序通过迁移工具应用 [初始数据库迁移](supabase/migrations/202611050001_initial.sql)、[测试额度迁移](supabase/migrations/202611050002_quota.sql) 与 [账号密钥及权限增量迁移](supabase/migrations/20261115040005_add_private_credentials_and_grants.sql)。已有项目若执行过前两份迁移，只需执行第三份；不要重新执行初始迁移。从项目设置中取得 URL 和 publishable key，写入 .env.local 的 NEXT_PUBLIC_SUPABASE_URL、NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY。手机号只是登录标识，服务端用不可投递的内部邮箱别名为它建立已确认的 Auth 用户，所以不需要启用 Phone/SMS，也不会向手机发验证码；**这不证明号码归属，公开运营前应增加验证、找回密码和持久化限流**。服务端注册必须配置 SUPABASE_SECRET_KEY，绝不能加 NEXT_PUBLIC_ 前缀。已有邮箱账号不会自动转换为手机号账号，原历史仍属于旧账号，不要删除旧账号。

若使用自己的 DeepSeek Key，不必填写服务端 DEEPSEEK_API_KEY；登录后在对话页选择“我的 DeepSeek API”，首次保存一次即可。此功能需要在 .env.local 中配置 SUPABASE_SECRET_KEY 与 ERIS_API_KEY_ENCRYPTION_KEY（32 字节随机值的 Base64 编码）。可用 `node -e 'console.log(require("node:crypto").randomBytes(32).toString("base64"))'` 生成加密密钥；请将其安全备份，丢失或更换后已保存的个人 Key 将无法解密。若启用固定测试账号，还需设置 ERIS_TEST_USERNAME、ERIS_TEST_PASSPHRASE、DEEPSEEK_API_KEY，然后运行 `node --env-file=.env.local scripts/provision-test-account.mjs`，把测试身份写入 Supabase Auth；该脚本只用于首次建号，不会覆盖已存在账号的暗号。按需设置 DEEPSEEK_MODEL 和 ERIS_TEST_DAILY_LIMIT。生产环境测试额度同样使用 SUPABASE_SECRET_KEY。不要把真实密钥或暗号提交到 GitHub；Supabase secret key 和加密密钥只能放在服务端，绝不能加 NEXT_PUBLIC_ 前缀。

完成配置后启动：

```bash
npm run dev
```

打开 http://localhost:3000，先注册或登录，再进入场景。旧版匿名会话不会自动迁入新账号；若之前用匿名身份保存过记录，请先保留原浏览器数据，不要在确认迁移方案前清理。

验证代码：

```bash
npm run typecheck
npm test
npm run build
```

开发服务器运行时，可在另一终端执行十回合真实对话验收：

```bash
node --env-file=.env.local scripts/qa-conversation.mjs 10
```

该脚本使用固定测试账号和测试额度，产生 DeepSeek API 调用；不写入真实聊天记录。传入 1 到 10 可缩短测试轮数。

策划案要求的九个场景保存在 [场景数据文件](tests/fixtures/qa-scenarios.json)，通过[发布名单](lib/reviewed-library.ts)进入模板库，同时用于模型回归检查。运行全部场景：

```bash
node --env-file=.env.local scripts/qa-nine-scenarios.mjs
```

也可在命令末尾传入单个场景 ID。每个场景会消耗一次测试额度和对应的 DeepSeek 请求。

Python 原型仍可使用 `python3.12 -m venv .venv && source .venv/bin/activate && pip install -e . && streamlit run app.py` 独立启动；它不是正式 Web 应用入口。

## 安全与边界

ERIS 不预测现实人物，不提供心理治疗、诊断或操纵他人的话术。用户可暂停、降低强度、结束和删除；遇到自伤、现实暴力或立即危险时应停止普通角色模拟，并联系当地紧急服务或可信任的人。请勿输入不必要的私人敏感资料。

当前开发环境已验证 DeepSeek 连续对话、Supabase 读写与权限；新部署环境仍需重新配置和实测。浏览器完整操作流程、多人试用与公开发布尚待验收。
