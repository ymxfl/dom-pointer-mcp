---
"@dom-pointer-mcp/server": patch
---

精简 `/pointed` 指令体：把各模式（EXECUTE 立即执行/询问、GET 只读确认、clear/update 上报等）的详细行为从触发文案迁移到对应 MCP 工具的 description 里，指令体只保留参数解析与「按第一个参数决定模式并调用哪个工具」的分发规则。同时在工具描述中补充 referenceImages 字段说明与更新后需重启 MCP 进程的提示。
