// Shared name for both command and skill
export const TRIGGER_NAME = 'pointed';

// --- Shared fragments ---

const PARAM_HINT = `Optional trailing integers 0-3 set textDetail and cssLevel positionally.
If none are given, call the tool with NO arguments (server uses its own defaults).
- \`/pointed 0 0\` → \`{ textDetail: 0, cssLevel: 0 }\`
- \`/pointed 1 2\` → \`{ textDetail: 1, cssLevel: 2 }\`
Strip these numbers from the user's note before treating remaining text as instructions.`;

const ELEMENT_READING = `Read the returned payload:
- \`userNote\`: the user's primary instruction
- \`selectionId\`: stable id for this selection
- \`screenshot.path\`: local screenshot file path when available
- The MCP response also includes the screenshot as image content when the file is available
- \`elements[]\`: DOM info per element (selector, componentInfo.sourceFile, cssProperties, url)
- Reference elements by 1-based index when user uses [1], [2] notation
- For visual UI/layout/color changes, inspect the attached image content immediately;
  fall back to \`screenshot.path\` only if the runtime does not expose image content`;

const NO_SELECTION_HINT = 'If the tool returns "No selection pointed", tell the user to Option+Click elements in the browser and press Cmd/Ctrl+Enter before retrying.';

const FAST_PATH_RULE = `Core product rule:
- The user intentionally triggered \`/pointed\`; do not wait for automatic intent detection.
- Do not list tools, browse, or ask what to call first.
- The first action after mode parsing MUST be the exact MCP tool call for that mode.`;

const HISTORY_MODE = `### HISTORY mode

If the first arg is \`history\` or \`list\`:
1. Call \`list-pointed-selections\` IMMEDIATELY with no arguments.
2. Return a compact list: selectionId, timestamp, elementCount, note preview, screenshotPath if present.
3. Do not modify files.

If the first arg is \`use\` followed by a selectionId:
1. Call \`get-pointed-selection\` IMMEDIATELY with that \`selectionId\` plus optional textDetail/cssLevel.
2. Then follow EXECUTE mode using that historical payload.
3. Text after the selectionId is a refinement of \`userNote\`.

If the first arg is \`clear\`:
1. Call \`clear-pointed-selections\` IMMEDIATELY.
2. If a selectionId follows \`clear\`, pass it as \`selectionId\`; otherwise clear all.
3. Report only the removed count.`;

const UPDATE_MODE = `### UPDATE mode

If the first arg is \`update\`:
1. Call \`check-update\` IMMEDIATELY.
2. If the second arg is \`apply\`, pass \`{ action: "apply" }\`; otherwise pass \`{ action: "check" }\` (or omit action).
3. Report currentVersion, latestVersion, updateAvailable, launchHint, applied, and message.
4. Do not modify project source files. For npx launches, tell the user to restart MCP to pick up @latest.
5. Extension updates are handled in the Chrome extension popup (CWS or GitHub), not by this tool.`;

// --- GET mode with cross-agent ask-tool mapping ---

const GET_MODE = `### GET mode (read-only preview)

⚠️ **CRITICAL: In GET mode, after summarizing elements you MUST ask the user for confirmation. Do NOT take ANY other action (no searching, no reading files, no answering questions, no code analysis) until the user confirms.**

1. Summarize the pointed elements concisely: include page URL, userNote, and for each element its component name, source file, and tag.
2. Pick the confirmation tool based on which agent you are running under:
   - Claude Code → use \`AskUserQuestion\`
   - Codex → use \`request_user_input\`
   - JoyCode → use \`task_ask_question\`
   - Cursor → use \`ask_question\`
   - OpenCode → use \`AskUserQuestion\`
   - Any other agent → use your own platform's user-interaction tool; if none exists, ask the user directly with plain text and wait for their reply.
3. Ask the user:
   - If \`userNote\` is non-empty → question: "用户备注为「{userNote}」，是否继续？"，options: "继续" (description: "按备注内容执行操作") 和 "取消" (description: "不做任何操作").
   - If \`userNote\` is empty → question: "你想对这些元素做什么？"，options: "自定义操作" (description: "输入具体操作指令") 和 "取消" (description: "不做任何操作").
4. **STOP HERE. Do NOT read files, search code, or perform any action. Wait for user selection.**
5. If user selects "取消" → respond "已取消" and end. Do NOT proceed.`;

function buildBody(): string {
  return `# /pointed

${FAST_PATH_RULE}

## Step 1 — Determine mode BEFORE calling the tool

**If the first arg is "get"** → you are in **GET mode (read-only, NO file modifications allowed)**.
**If the first arg is "history" or "list"** → you are in **HISTORY mode (read-only list)**.
**If the first arg is "use" plus a selectionId** → you are in **HISTORY EXECUTE mode**.
**If the first arg is "clear"** → you are in **CLEAR mode**.
**If the first arg is "update"** → you are in **UPDATE mode**.
**Otherwise** → you are in **EXECUTE mode**.

Remember which mode you are in. This decision is FINAL and cannot change after the tool call.

## Step 2 — Call the tool

- EXECUTE mode: call \`get-pointed-element\` IMMEDIATELY with no questions.
- GET mode: call \`get-pointed-element\` IMMEDIATELY with no questions.
- HISTORY mode: follow the HISTORY mode tool call rules below.
- UPDATE mode: follow the UPDATE mode tool call rules below.

Parse optional trailing integers as textDetail/cssLevel; if absent, pass NO arguments.

## Step 3 — Act according to mode

---

${HISTORY_MODE}

${UPDATE_MODE}

${GET_MODE}

### EXECUTE mode (default)

1. ${ELEMENT_READING}
2. If \`userNote\` is non-empty → execute the requested changes in source code immediately. Do NOT ask for confirmation.
   If \`userNote\` is empty → ask: "你想对这些元素做什么？" and wait for the user's reply before doing anything.

Text after \`/pointed\` (excluding "get") is a refinement of \`userNote\`.

${PARAM_HINT}

${NO_SELECTION_HINT}
`;
}

const BODY = buildBody();

// --- Slash command ---

export const COMMAND_DESCRIPTION = "Fetch the user's pointed elements (Option+Click in browser) and act on their note.";

export const COMMAND_BODY = BODY;

// --- Skill (same content, different install mechanism) ---

export const SKILL_DESCRIPTION = COMMAND_DESCRIPTION;

export const SKILL_BODY = BODY;
