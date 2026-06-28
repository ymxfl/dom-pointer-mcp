---
"@dom-pointer-mcp/server": patch
"@dom-pointer-mcp/chrome-extension": patch
---

Codex 配置改为安装 Skill 到 `~/.codex/skills/pointed/SKILL.md`，不再使用已废弃的 prompts 斜杠命令；同时修复 Claude、JoyCode、Codex 卸载 Skill 时残留空目录的问题（改为递归删除整个 skill 目录）。历史抽屉笔记新增 hover 提示，便于查看被截断的完整备注。
