#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

pnpm install
pnpm --filter @dom-pointer-mcp/chrome-extension run build
pnpm --filter @dom-pointer-mcp/server run build

(
  cd packages/server
  npm link --no-audit --no-fund
)

exec dom-pointer-mcp config
