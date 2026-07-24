// Shared name for both command and skill
export const TRIGGER_NAME = 'pointed';

// --- Shared fragments ---

// Detailed per-mode behavior (payload fields, EXECUTE apply/ask rule, GET
// confirmation gate, clear/update reporting) lives in the MCP tool
// descriptions, which load once per session. This body only carries what the
// tools cannot see: how to parse the /pointed args and which tool to call.

const FAST_PATH_RULE = `Core product rule:
- The user intentionally triggered \`/pointed\`; do not wait for automatic intent detection.
- Do not list tools, browse, or ask what to call first.
- The first action after mode parsing MUST be the exact MCP tool call for that mode. Follow each tool's description for how to act on its result.`;

const ASK_TOOL_HINT = 'When a mode needs you to ask the user, use your agent\'s own user-interaction tool (Claude Code: AskUserQuestion; Codex: request_user_input; JoyCode: task_ask_question; Cursor: ask_question; OpenCode: AskUserQuestion; any other agent: its equivalent, or plain text if none).';

const PARAM_HINT = `Optional trailing integers 0-3 set textDetail and cssLevel positionally, then strip them from the note.
If none are given, call the tool with NO arguments (server uses its own defaults).
- \`/pointed 0 0\` → \`{ textDetail: 0, cssLevel: 0 }\`
- \`/pointed 1 2\` → \`{ textDetail: 1, cssLevel: 2 }\``;

function buildBody(): string {
  return `# /pointed

${FAST_PATH_RULE}

## Determine mode BEFORE calling the tool, from the first arg. This decision is FINAL.

- \`get\` → GET mode (read-only preview): call \`get-pointed-element\` IMMEDIATELY.
- \`history\` or \`list\` → call \`list-pointed-selections\` IMMEDIATELY (no args).
- \`use\` + selectionId → call \`get-pointed-selection\` IMMEDIATELY with that selectionId (+ optional integers).
- \`clear\` → call \`clear-pointed-selections\` IMMEDIATELY (pass a trailing selectionId, or omit to clear all).
- \`update\` → call \`check-update\` IMMEDIATELY (\`{ action: "apply" }\` if the next arg is \`apply\`, else \`{ action: "check" }\` or omit).
- otherwise → EXECUTE mode (default): call \`get-pointed-element\` IMMEDIATELY. Text after \`/pointed\` refines \`userNote\`.

Each tool's description defines how to act on its result (EXECUTE apply-vs-ask rule, GET confirmation gate, reporting).

${ASK_TOOL_HINT}

${PARAM_HINT}`;
}

const BODY = buildBody();

// --- Slash command ---

export const COMMAND_DESCRIPTION = "Fetch the user's pointed elements (Option+Click in browser) and act on their note.";

export const COMMAND_BODY = BODY;

// --- Skill (same content, different install mechanism) ---

export const SKILL_DESCRIPTION = COMMAND_DESCRIPTION;

export const SKILL_BODY = BODY;
