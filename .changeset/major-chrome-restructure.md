---
"@mcp-pointer/chrome-extension": minor
---

Major chrome extension architecture overhaul with improved service-based structure

- Remove bridge.js system for direct Chrome API access in isolated world
- Eliminate URL filtering complexity  
- Split functionality into focused services
- Consolidate utilities and improve overlay management
- Add proper enable/disable functionality

This is a breaking change that significantly improves maintainability.