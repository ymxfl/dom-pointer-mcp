---
'@dom-pointer-mcp/server': patch
---

将共享运行文件（shared-state、screenshots）的根目录从系统临时目录改为固定的 `~/.dom-pointer-mcp`，避免不同进程 TMPDIR 环境变量不一致导致读写路径分裂。
