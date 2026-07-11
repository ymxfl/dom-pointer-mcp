# AGENTS.md

## Cursor Cloud specific instructions

### Stack

- pnpm workspace monorepo (`pnpm@10.15.0`, Node 18+)
- Packages: `packages/server` (MCP + WebSocket), `packages/chrome-extension` (MV3), `packages/shared`

### Bootstrap

```bash
pnpm install --frozen-lockfile
pnpm build
```

Do **not** manually run esbuild's `install.js`. Optional platform packages already provide the binary; forcing `install.js` can replace the JS shim with a raw ELF and break `pnpm` script invocation.

### Verify

```bash
pnpm lint
pnpm typecheck
pnpm test
node packages/server/dist/cli.cjs --version
node packages/server/dist/cli.cjs doctor
```

### Run locally

```bash
# MCP server (WebSocket :7007 + MCP over stdio)
node packages/server/dist/cli.cjs start

# Or watch mode
pnpm -C packages/server dev

# Chrome extension watch build → packages/chrome-extension/dev/
pnpm -C packages/chrome-extension dev
```

Load `packages/chrome-extension/dev/` (dev) or `packages/chrome-extension/dist/` (prod) as an unpacked extension in Chrome.

### Architecture notes

- Extension ↔ server talk over WebSocket on port `7007` (message types are kebab-case, e.g. `selection-sent`).
- Shared selection state lives under `/tmp/dom-pointer-mcp/`.
- Multiple server instances: first binder is leader; followers still serve MCP from shared state.
