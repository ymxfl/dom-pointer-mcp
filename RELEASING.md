# 发布流程

本项目使用 [changesets](https://github.com/changesets/changesets) 管理版本和发布。

## 包发布方式

| 包 | 发布目标 |
|----|----------|
| `@dom-pointer-mcp/server` | npm |
| `@dom-pointer-mcp/chrome-extension` | GitHub Release (zip 附件) |

## 完整发布步骤

### 1. 创建修复/功能分支

```bash
git checkout -b <type>/<description> origin/main
```

### 2. 编写 changeset

在 `.changeset/` 下创建文件，声明受影响的包和版本级别：

```markdown
---
"@dom-pointer-mcp/chrome-extension": patch
---

修复描述
```

bump 级别：`patch`（修复）、`minor`（新功能）、`major`（破坏性变更）。

### 3. 提交并创建 PR

```bash
git add .
git commit -m "fix(scope): 描述"
git push -u origin <branch>
gh pr create --title "..." --body "..."
```

### 4. 合并 PR

CI 通过后 squash merge：

```bash
gh pr merge <number> --squash
```

### 5. 合并 Version Packages PR

合并到 main 后，changeset bot 会自动创建 **Version Packages** PR，内容包括：
- 版本号 bump
- CHANGELOG 更新
- chrome-extension 的 manifest.json 版本同步

确认内容无误后合并：

```bash
gh pr merge <number> --squash
```

### 6. 自动发布

合并 Version Packages PR 后，CI 自动执行：
- **server 版本变更** → 发布到 npm + 打包 chrome-extension zip 上传到 GitHub Release
- **仅 chrome-extension 版本变更** → 独立检测步骤创建 tag 并上传 zip

## 注意事项

- changeset 和 commit message 统一使用**中文**
- 分支始终基于 `origin/main` 创建，避免 stale base
- chrome-extension 是 `private: true` 包，changeset 的 `published` 输出不会反映其发布状态，由 CI 中的独立检测步骤处理
- 发版前检查 README 是否需要同步更新
