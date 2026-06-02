---
"@dom-pointer-mcp/chrome-extension": minor
"@dom-pointer-mcp/server": minor
---

feat: configurable trigger key with page-level conflict detection

- Add user-configurable modifier key (Alt/Ctrl/Meta) in popup settings
- Detect page-level keyboard event listeners via addEventListener interception
- Show in-page toast notification with alternative key suggestion when conflict detected
- Platform-aware display names (Option/Command on Mac, Alt/Win on Windows)
