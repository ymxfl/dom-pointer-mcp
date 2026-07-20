---
"@dom-pointer-mcp/chrome-extension": patch
---

修复扩展版本号显示错误：GitHub Release 现始终以扩展自身版本号命名，不再借用 server 版本，避免"检查更新提示新版但装上仍是旧版"的死循环。Agent 安装命令指定官方镜像源 `--registry=https://registry.npmjs.org/`，避免从私有镜像装到陈旧的 server。检查更新改为从 releases 列表挑选纯 semver 标签的最新 Release，server 单独发版不再干扰扩展更新检查。
