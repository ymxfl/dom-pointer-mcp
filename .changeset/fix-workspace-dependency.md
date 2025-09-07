---
"@mcp-pointer/server": patch
---

Fix npm publish by moving shared package to devDependencies

- Move @mcp-pointer/shared from dependencies to devDependencies
- Resolves "workspace:*" protocol issue when publishing to npm
- Shared code is bundled by esbuild so not needed at runtime