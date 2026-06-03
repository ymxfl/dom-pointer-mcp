---
"@dom-pointer-mcp/chrome-extension": patch
---

修复 HTTP 页面上复制按钮报错的问题，当 navigator.clipboard 不可用时降级使用 execCommand
