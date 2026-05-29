# 2026-05-29 首次发布记录

## 目标

把 `@dom-pointer-mcp/server` 和 Chrome 扩展首发到公网，建立后续可重复的发布流水线。

## 仓库背景

仓库已搭好基于 **Changesets + GitHub Actions + pnpm workspace** 的自动化流水线（`.github/workflows/release.yml`），但本次首发跳过 changesets 直接手动发布 1.0.0，因为：
- 三个包 `package.json` 都已是 `1.0.0`
- npm 上 scope 还未创建，无历史版本
- 走 changesets 流程反而要先把版本 bump 到 1.0.1，不符合"首发 1.0.0"语义

## 已完成步骤

### 1. npm scope 准备
- 本机 `npm login` 已完成，用户 `ymxfl`
- 在 npmjs.com 创建了 organization **`dom-pointer-mcp`**（Free 计划，公开包免费）
- 验证：`npm org ls dom-pointer-mcp` → `ymxfl - owner`

### 2. 修复阻塞发布的测试
- `packages/chrome-extension/src/extractors/__tests__/index.test.ts` 中 fixture 用 `Object.defineProperty` 创建属性但漏写 `enumerable: true`
- React extractor 通过 `Object.keys(element)` 找 `__reactFiber$x`，看不到不可枚举属性，导致 orchestrator 测试返回 `undefined`
- 生产代码不受影响（真实浏览器里 React 用普通赋值，默认 enumerable）
- 修复方式：在两个 `Object.defineProperty` 调用中加 `enumerable: true`
- commit: `0a6f985 test(extractors): mark fixture properties enumerable for React fiber lookup`

### 3. 构建产物
- `pnpm install --frozen-lockfile` → 通过
- `pnpm test` → 134 server + 42 extension 全绿
- `pnpm build` → 产出
  - `packages/server/dist/cli.cjs` (1.7 MB)
  - `packages/chrome-extension/dist/` (manifest.json + background/content/popup/main-world js + css/html/png)

### 4. npm 发布 `@dom-pointer-mcp/server@1.0.0`
- `cp README.md packages/server/README.md`（仿 CI 行为）
- `pnpm publish --access public --no-git-checks`
- 首次失败：2FA 强制要求 OTP（403 Forbidden）
- 处理：用户在 npmjs.com 创建了带 "Bypass 2FA" 的 Granular Token，写入 `~/.npmrc`
- 重试成功，tarball 950 KB，包含 LICENSE/README/dist/cli.cjs/package.json
- 验证：`npm view @dom-pointer-mcp/server version` → `1.0.0`
- 清理：`rm packages/server/README.md`（仓库历史里这文件本就有，从 HEAD checkout 恢复）

### 5. Chrome 扩展打包
- `cd packages/chrome-extension/dist && zip -r dom-pointer-mcp-chrome-extension.zip .`
- 产出 41 KB zip，含完整扩展文件

### 6. GitHub Release v1.0.0
- 把测试修复 push 到 `dev-20260528`，再 `git push origin dev-20260528:main` fast-forward main
- `git tag -a v1.0.0 -m "Release v1.0.0"` + `git push origin v1.0.0`
- `gh release create v1.0.0 dom-pointer-mcp-chrome-extension.zip --title "v1.0.0 — DOM Pointer MCP" --notes "..."`
- Release URL: https://github.com/ymxfl/dom-pointer-mcp/releases/tag/v1.0.0

### 7. CI workflow 修复
- 现象：push 到 main 后 CI / Release 两个 workflow 都失败
- 根因：`.github/workflows/{ci,release}.yml` 用了 `pnpm/action-setup@v2 with: version: latest`，安装了 pnpm 11.4.0，而 pnpm 11 需要 Node 22+，workflow 用的是 Node 20，启动时 `ERR_UNKNOWN_BUILTIN_MODULE: node:sqlite`
- 修复：两个 workflow 都改成 `pnpm/action-setup@v4` + `version: 10.15.0`（锁到 `package.json` 的 `packageManager`）
- commit: `8d53366 ci: pin pnpm to 10.15.0 to avoid pnpm@11 requiring Node 22+`

## ⚠️ 当前卡住的问题

**症状**：CI 修复 push 后，新一轮 CI / Release workflow 在 `pnpm install --frozen-lockfile` 阶段大量超时：
```
WARN  GET http://registry.npmjs.org/reconnecting-websocket/download/...tgz (ERR_SOCKET_TIMEOUT)
WARN  GET http://registry.npmjs.org/@floating-ui/dom/download/...tgz (ERR_SOCKET_TIMEOUT)
```

**根因**：`pnpm-lock.yaml` 里 789 个依赖的 `tarball:` 字段全部硬编码为 `http://registry.npmjs.org/...`（私有镜像源）。这份 lockfile 是历史在私有镜像生成并提交进仓库的。pnpm 默认严格按 lockfile 里的 URL 下载，GitHub Actions 访问不到 私有镜像导致超时。

**需求约束**：
- 本地必须能用 jd 源 install（npmjs.org 国内拉不动，太慢）
- CI 必须用 npmjs.org（GHA 访问不到 jd）
- 不希望在仓库配置里强绑某个 registry，让本地 / CI 各自按自己 npm 配置走

### 已尝试但失败的方案

| 尝试 | 结果 | 备注 |
|---|---|---|
| `.npmrc` 加 `replace-registry-host=always` | ❌ 无效 | **这个 pnpm 设置实际不存在**（我之前编的，pnpm 静默忽略未知配置） |
| `.npmrc` 加 `lockfile-include-tarball-url=false` + 删 lockfile + 用 jd 源重装 | ❌ 新 lockfile 仍写 789 处 jd tarball URL | pnpm 10 可能要求该设置放在 `pnpm-workspace.yaml` 里且用 camelCase |
| `pnpm-workspace.yaml` 加 `lockfileIncludeTarballUrl: false` + 删 lockfile + 重装 | ❌ 仍写 URL | `pnpm config get` 报告设置已生效但行为没变 |
| 设置环境变量 `NPM_CONFIG_LOCKFILE_INCLUDE_TARBALL_URL=false` | ❌ 同上 | |
| CLI 标志 `--no-lockfile-include-tarball-url` | ❌ Unknown option | pnpm CLI 不认这个标志 |

**怀疑**：pnpm 10.15.0 的 `lockfileIncludeTarballUrl` 行为可能只在 registry 为 npmjs.org 默认地址时才省略 URL；非默认 registry 仍会写出 URL 以保证 lockfile 可重现。需要进一步验证。

### 待选下一步方案

| 方案 | 做法 | 取舍 |
|---|---|---|
| **A. sed 替换 host** | `sed -i '' 's#registry.npmjs.org#registry.npmjs.org#g' pnpm-lock.yaml` | 一行解决，但 lockfile 绑死 npmjs；本地用 jd 装会触发 pnpm 的 fallback（lockfile URL 失败 → 回退到 registry 重试），多一次失败开销 |
| **B. 用 npmjs.org 重生 lockfile** | 临时切 npm registry 到 npmjs，删 lockfile，pnpm install，等几十分钟 | lockfile 干净（不带 URL 或带 npmjs URL，看 pnpm 实际行为）；本地下次装包又走 npmjs 慢 |
| **C. CI 里临时 sed** | 在 ci.yml / release.yml 的 install 步骤前加 `sed` 替换 host | lockfile 维持原样，本地不受影响；CI 多一个看不见的"隐藏修复" |
| **D. CI 缓存 pnpm store** | `actions/cache` 缓存 `~/.local/share/pnpm/store`；首跑仍可能超时，缓存命中后无所谓 URL | 治标；首次和缓存失效时仍会失败 |

## 仍未完成的后续事项

1. **CI 跑通**（被上面问题卡住）
2. **Chrome Web Store 首次上架（手动）** —— 用户拿到 Release 的 zip 后上传到 Chrome 开发者控制台，等审核通过。拿到 extension ID 后才能配置 Chrome Web Store API 自动化。
3. **`packages/server/package.json` 的 `main: dist/index.js` 不存在**（构建只产出 `cli.cjs`）。`bin` 入口能用，但 `import '@dom-pointer-mcp/server'` 会失败。下个 patch 时清理。

## 关键产出

| 产物 | 地址 |
|---|---|
| npm package | https://www.npmjs.com/package/@dom-pointer-mcp/server |
| GitHub Release | https://github.com/ymxfl/dom-pointer-mcp/releases/tag/v1.0.0 |
| Tag | `v1.0.0` → 指向 commit `0a6f985`（含测试修复） |
| main 分支当前 HEAD | `8d53366`（含 CI 修复，但 CI 仍未通过） |

## 安装方式（用户视角）

```bash
# MCP server
npx -y @dom-pointer-mcp/server@1.0.0 start

# Chrome 扩展
# 1. 从 https://github.com/ymxfl/dom-pointer-mcp/releases/tag/v1.0.0 下载 zip
# 2. chrome://extensions → 开发者模式 → 加载已解压的扩展程序
# 3. 待 Chrome Web Store 上架后可直接从商店安装
```
