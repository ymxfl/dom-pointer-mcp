# Check Updates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add dual-channel Chrome extension update checks (CWS + GitHub) and server update via MCP tool / CLI / `/pointed update`.

**Architecture:** Pure update services with injectable fetch/chrome/npm deps; popup and MCP/CLI are thin callers; Pointed skill gains UPDATE mode that calls `check-update`.

**Tech Stack:** TypeScript, Jest, Chrome MV3 APIs, GitHub Releases API, npm registry, Commander CLI, MCP SDK.

---

## File map

| File | Responsibility |
|------|----------------|
| `packages/chrome-extension/src/utils/semver.ts` | Compare/parse semver strings |
| `packages/chrome-extension/src/services/update-check-service.ts` | CWS + GitHub extension update check |
| `packages/chrome-extension/src/__tests__/services/update-check-service.test.ts` | Extension update tests |
| `packages/chrome-extension/src/__tests__/utils/semver.test.ts` | Semver helper tests |
| `packages/chrome-extension/src/services/popup-manager-service.ts` | Wire UI |
| `packages/chrome-extension/src/popup.html` / `popup.css` | Update section UI |
| `packages/chrome-extension/src/i18n/{zh,en}.ts` | Copy |
| `packages/server/src/utils/semver.ts` | Shared-style semver (server copy, keep packages independent) |
| `packages/server/src/services/update-service.ts` | npm check + apply |
| `packages/server/src/__tests__/services/update-service.test.ts` | Server update tests |
| `packages/server/src/services/mcp-service.ts` | Register `check-update` |
| `packages/server/src/cli.ts` / `commands.ts` | `update` command |
| `packages/server/src/config/trigger-content.ts` | UPDATE mode |
| `packages/server/src/config/__tests__/trigger-content.test.ts` | Assert UPDATE mode |

### Task 1: Semver helpers (extension + server)

- [ ] Write failing tests for `compareSemver` / `isNewerVersion`
- [ ] Implement minimal helpers
- [ ] Commit

### Task 2: Extension UpdateCheckService

- [ ] Failing tests: GitHub newer/same/error; CWS update_available/no_update/throttled; auto fallback
- [ ] Implement service
- [ ] Commit

### Task 3: Extension Popup UI + i18n

- [ ] Add version + check button + result area
- [ ] Wire PopupManagerService
- [ ] Commit

### Task 4: Server update-service

- [ ] Failing tests: check newer/same/network error; apply npx hint vs global install
- [ ] Implement
- [ ] Commit

### Task 5: MCP tool + CLI + Pointed UPDATE mode

- [ ] Add tool, CLI command, skill text + tests
- [ ] Commit

### Task 6: Changeset, verify lint/test/build, push PR

- [ ] Add changeset (minor for both packages)
- [ ] Run lint/test/build
- [ ] Push and open PR
