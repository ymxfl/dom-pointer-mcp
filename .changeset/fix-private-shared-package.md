---
"@mcp-pointer/server": patch
---

Fix release workflow by making shared package private

- Make @mcp-pointer/shared private to prevent npm publishing attempts
- Update changeset configuration to remove package linking
- Only @mcp-pointer/server will be published to npm going forward