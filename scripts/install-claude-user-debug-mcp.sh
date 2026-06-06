#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

SERVER_NAME="dom-pointer"
PORT="7007"
PNPM_BIN="${PNPM_BIN:-}"
NODE_BIN="${NODE_BIN:-}"
SKIP_BUILD=0

usage() {
  cat <<'EOF'
Build the local MCP server and install its dist CLI into Claude Code user scope.

Usage:
  scripts/install-claude-user-debug-mcp.sh [--port 7007] [--name dom-pointer] [--skip-build]

Options:
  --port <port>   WebSocket port exposed to the Chrome extension. Default: 7007
  --name <name>   Claude MCP server name. Default: dom-pointer
  --skip-build    Do not rebuild; install the existing packages/server/dist/cli.cjs
  -h, --help      Show this help.

The installed Claude MCP command points at the built local CLI:
  node <repo>/packages/server/dist/cli.cjs start
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --)
      shift
      ;;
    --port)
      PORT="${2:-}"
      shift 2
      ;;
    --name)
      SERVER_NAME="${2:-}"
      shift 2
      ;;
    --skip-build)
      SKIP_BUILD=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [[ -z "$PORT" || ! "$PORT" =~ ^[0-9]+$ || "$PORT" -lt 1 || "$PORT" -gt 65535 ]]; then
  echo "Invalid --port value: ${PORT:-<empty>}" >&2
  exit 1
fi

if [[ -z "$SERVER_NAME" ]]; then
  echo "Invalid --name value: empty" >&2
  exit 1
fi

if ! command -v claude >/dev/null 2>&1; then
  echo "Claude Code CLI not found. Install Claude Code CLI first." >&2
  exit 1
fi

if [[ -z "$PNPM_BIN" ]]; then
  if ! PNPM_BIN="$(command -v pnpm)"; then
    echo "pnpm not found. Install pnpm first, or set PNPM_BIN=/absolute/path/to/pnpm." >&2
    exit 1
  fi
fi

if [[ -z "$NODE_BIN" ]]; then
  if ! NODE_BIN="$(command -v node)"; then
    echo "node not found. Install Node.js first, or set NODE_BIN=/absolute/path/to/node." >&2
    exit 1
  fi
fi

DIST_CLI="$REPO_ROOT/packages/server/dist/cli.cjs"

if [[ "$SKIP_BUILD" -eq 0 ]]; then
  echo "Building @dom-pointer-mcp/server..."
  "$PNPM_BIN" --dir "$REPO_ROOT" --filter "@dom-pointer-mcp/server" build
fi

if [[ ! -f "$DIST_CLI" ]]; then
  echo "Cannot find built CLI: $DIST_CLI" >&2
  echo "Run: pnpm --filter @dom-pointer-mcp/server build" >&2
  exit 1
fi

echo "Installing Claude user MCP entry '$SERVER_NAME' for built local debug server..."
echo "Repo: $REPO_ROOT"
echo "Port: $PORT"
echo "Command: $NODE_BIN $DIST_CLI start"

claude mcp remove "$SERVER_NAME" -s user >/dev/null 2>&1 || true

claude mcp add "$SERVER_NAME" -s user \
  --env "MCP_POINTER_PORT=$PORT" \
  -- "$NODE_BIN" "$DIST_CLI" start

echo "Installed. Restart Claude Code so it reloads the user MCP config."
