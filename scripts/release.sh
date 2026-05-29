#!/usr/bin/env bash
# Prepare a release: verify locally, create a changeset, commit, push.
# CI (.github/workflows/release.yml) takes over from there:
# opens a version-bump PR, and on merge publishes to npm + uploads the
# Chrome extension zip to the GitHub Release.
#
# Two modes:
#   pnpm release:prepare
#     Interactive: changeset CLI prompts for bump type and summary.
#
#   pnpm release:prepare --type <patch|minor|major> --summary "<text>"
#     Non-interactive: writes the changeset file directly. Convenient for
#     agents that already know what kind of bump and what summary to write.
#     Optional: --message "<commit msg>" to override the commit message.
set -euo pipefail

cd "$(dirname "$0")/.."

c_red=$'\033[31m'; c_grn=$'\033[32m'; c_ylw=$'\033[33m'; c_dim=$'\033[2m'; c_off=$'\033[0m'
step() { printf '\n%s==>%s %s\n' "$c_grn" "$c_off" "$1"; }
warn() { printf '%swarn:%s %s\n' "$c_ylw" "$c_off" "$1"; }
die()  { printf '%serror:%s %s\n' "$c_red" "$c_off" "$1" >&2; exit 1; }

bump_type=""
summary=""
commit_message=""

while [ $# -gt 0 ]; do
  case "$1" in
    --type)    bump_type="${2:-}"; shift 2 ;;
    --summary) summary="${2:-}";   shift 2 ;;
    --message) commit_message="${2:-}"; shift 2 ;;
    -h|--help)
      sed -n '2,14p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *) die "Unknown arg: $1 (try --help)" ;;
  esac
done

# Validate non-interactive args together — both required or neither.
if [ -n "$bump_type" ] || [ -n "$summary" ]; then
  [ -n "$bump_type" ] || die "--summary requires --type"
  [ -n "$summary" ]   || die "--type requires --summary"
  case "$bump_type" in
    patch|minor|major) ;;
    *) die "--type must be patch | minor | major (got: $bump_type)" ;;
  esac
fi

# 1. Tree must be clean — version bumps happen on a clean base, not on top of WIP.
step "Checking working tree"
if [ -n "$(git status --porcelain)" ]; then
  git status --short
  die "Working tree not clean. Commit or stash first."
fi

current_branch=$(git rev-parse --abbrev-ref HEAD)
if [ "$current_branch" = "main" ]; then
  warn "You are on main. Releases normally happen from a feature branch via PR."
  if [ -z "$bump_type" ]; then
    read -r -p "Continue anyway? [y/N] " ans
    [ "$ans" = "y" ] || [ "$ans" = "Y" ] || die "Aborted."
  else
    die "Refusing to auto-prepare release directly on main. Switch to a feature branch."
  fi
fi

# 2. Local verification — same gates CI runs.
step "Lint";      pnpm lint
step "Typecheck"; pnpm typecheck
step "Tests";     pnpm test
step "Build";     pnpm build

# 3. Changeset — either write the file directly or hand off to changeset CLI.
step "Creating changeset"
if [ -n "$bump_type" ]; then
  # Slug: short, unique, no Date.now reliance (use git short SHA + nanos from /dev/urandom).
  rand_suffix=$(LC_ALL=C tr -dc 'a-z0-9' </dev/urandom | head -c 8)
  slug="release-${rand_suffix}"
  new_changeset=".changeset/${slug}.md"
  # server + chrome-extension are linked (.changeset/config.json), so listing
  # the server package alone is enough — changeset bumps both together.
  cat >"$new_changeset" <<EOF
---
"@dom-pointer-mcp/server": ${bump_type}
---

${summary}
EOF
  printf '%swrote%s %s\n' "$c_dim" "$c_off" "$new_changeset"
else
  printf '%sFollow the prompts. Pick the bump type and write a short summary.%s\n' "$c_dim" "$c_off"
  before=$(find .changeset -maxdepth 1 -name '*.md' ! -name 'README.md' 2>/dev/null | sort)
  pnpm changeset
  after=$(find .changeset -maxdepth 1 -name '*.md' ! -name 'README.md' 2>/dev/null | sort)
  new_changeset=$(comm -13 <(echo "$before") <(echo "$after"))
  [ -n "$new_changeset" ] || die "No new changeset detected. Aborted."
fi

# 4. Commit + push so CI can open the version-bump PR.
step "Committing changeset"
git add "$new_changeset"
default_msg="chore: add changeset for next release"
git commit -m "${commit_message:-$default_msg}"

step "Pushing to origin/$current_branch"
git push -u origin "$current_branch"

printf '\n%sDone.%s Changeset committed and pushed.\n' "$c_grn" "$c_off"
printf '  • Open a PR to main if you have not already.\n'
printf '  • After merge, CI opens a "Version Packages" PR.\n'
printf '  • Merging that PR publishes to npm and uploads the extension zip.\n'
