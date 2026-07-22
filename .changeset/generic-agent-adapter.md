---
"@dom-pointer-mcp/server": patch
---

新增"其他 Agent"通用配置：一次交互生成 MCP JSON（`~/.agents/mcp-pointed.json`）+ Skill（`~/.agents/skills/pointed/SKILL.md`），供未直接适配的 agent 手动复制。同时合并各 agent 的 Skill 内容为单一版本，通过映射表提示各 agent 使用对应的用户询问工具（AskUserQuestion / request_user_input / task_ask_question / ask_question）。所有 adapter 的 npx 启动参数统一加上 `--registry=https://registry.npmjs.org/`，绕开国内镜像同步延迟。
