# ERIS · 虚拟角色恋爱模拟器

这是开发文档中“第一条最短链路”的可运行版本：用户在 Streamlit 页面输入一句话，模型会按照临时角色“林澈”的结构化设定和最近对话进行回应。

当前版本只验证对话闭环，尚未加入角色创建、SQLite 持久化、关系状态、长期记忆或剧情导演。

## 本地启动

需要 Python 3.11 或更高版本。

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -e .
cp .env.example .env
```

编辑 `.env` 并填入你的 API Key：

```dotenv
OPENAI_API_KEY=your_api_key_here
OPENAI_MODEL=gpt-6-astra
```

启动应用：

```bash
streamlit run app.py
```

浏览器通常会自动打开 `http://localhost:8501`。

## 当前行为

- 角色设定在 `app.py` 中临时定义。
- 每次模型调用最多携带最近 12 条消息。
- 用户输入会先进入当前浏览器会话，再请求模型；模型失败时输入仍会保留。
- API 超时、限流、连接和服务错误会转换为可理解的提示。
- `.env`、虚拟环境和缓存文件不会进入 Git。

## 下一步

按开发文档顺序，完成并人工验证这条对话链路后，再进入角色系统；不会提前加入关系、记忆或剧情导演。

