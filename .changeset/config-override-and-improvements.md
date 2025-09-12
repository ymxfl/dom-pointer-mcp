---
"@mcp-pointer/server": patch
"@mcp-pointer/chrome-extension": patch
---

Fix config override and improve UI

- Fix MCP server configuration to override existing configurations by removing before adding
- Add comprehensive tests for config override scenarios
- Update border color to use CSS custom property for better theming
- Fix GitHub Actions badge URLs in README
- Add README copying to npm package in release workflow