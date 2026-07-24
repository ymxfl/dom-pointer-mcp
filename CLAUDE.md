# CLAUDE.md
## 始终使用中文回复
Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.
**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```
Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.
---
**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

## 5. 提交与分支规范

- **提交前必跑检查**：按顺序执行 `pnpm lint` → `pnpm typecheck` → `pnpm build` → `pnpm test`，全部通过后才能 commit / push（遵循 CONTRIBUTING.md 的 PR 流程；曾因跳过 test 导致 CI 失败）。
- **从 origin/main 建分支**：新分支必须基于 `origin/main`，不要基于本地 `main`（本地常落后于远端，会产生冲突 PR）。建分支前：`git fetch origin && git checkout -b <branch> origin/main`。若已基于陈旧本地 main：`git rebase --onto origin/main main <branch>`，之后 `git branch -f main origin/main`。
- **中文文案**：commit message、changeset 描述、PR 标题/正文、发版描述一律用中文；代码变量名、注释保持英文。
- **项目级 git 用户**：使用 `ymxfl` / `ymxfl@users.noreply.github.com`，不使用全局用户（避免暴露真实身份）。若发现被重置，执行 `git config user.name "ymxfl"` 与 `git config user.email "ymxfl@users.noreply.github.com"`。

## 6. 发布流程

本项目是 pnpm monorepo，含两个包：
- `@dom-pointer-mcp/server` — 公开包，发布到 npm
- `@dom-pointer-mcp/chrome-extension` — `private: true`，不发 npm，通过 GitHub Release 附件分发 zip

**用户说"发布"时**，全自动执行完整流程、无需逐步确认，遇 CI 失败或冲突自行排查修复：
1. 基于 origin/main 创建修复分支（如当前不在 main 上）
2. 在 `.changeset/` 下创建 md，声明正确的包名和 bump 级别（patch/minor/major）
3. 提交、推送、创建 PR（文案用中文）
4. 合并 PR（`gh pr merge --squash`）
5. 等待并合并 changeset bot 创建的 Version Packages PR
6. 合并 Version Packages PR 后触发 release：server 版本变则 publish 到 npm 并上传扩展 zip；仅扩展版本变时 changeset 不 publish（private 包），由独立检测步骤对比 git tag 判断新版本并创建 tag、上传 zip

**发版前检查 README**：对照本次改动确认 README 是否需同步（新功能说明、配置项、使用方式、截图），如需要在同一 PR 内更新。

**关键陷阱与配置**：
- `changesets/action` 的 `published` 输出仅当有包实际发布到 npm 才为 true；`private: true` 的包 bump 不触发它。因此扩展的打包/发布不能依赖该输出，需独立检测版本变化（对比 git tag）。
- `.changeset/config.json` 的 `linked` 已解除（`[]`）：server 与 chrome-extension 版本完全独立。
- 扩展 Release tag：始终用扩展自身版本号，同时打纯数字 `x.y.z`（供"检查更新"读取）+ 带包名 `@dom-pointer-mcp/chrome-extension@x.y.z`（归档）。server 走 npm + `@dom-pointer-mcp/server@x` tag，不再创建纯数字 Release。注意纯数字 tag 勿与历史遗留 server 纯数字 tag（1.7.0~1.7.3）冲突。