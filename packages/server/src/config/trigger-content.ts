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

// --- GET mode fragments (platform-specific) ---

const GET_MODE_GENERIC = `### GET mode (read-only preview)

⚠️ **CRITICAL: In GET mode, after summarizing elements you MUST ask the user for confirmation. Do NOT take ANY other action (no searching, no reading files, no answering questions, no code analysis) until the user confirms.**

1. Summarize the pointed elements concisely: include page URL, userNote, and for each element its component name, source file, and tag.
2. If \`userNote\` is non-empty → ask: "用户备注为「{userNote}」，是否继续？"
   If \`userNote\` is empty → ask: "你想对这些元素做什么？"
3. **STOP HERE. Do NOT read files, search code, or perform any action. Wait for user reply.**`;

const GET_MODE_CLAUDE = `### GET mode (read-only preview)

⚠️ **CRITICAL: In GET mode, after summarizing elements you MUST ask the user for confirmation via AskUserQuestion. Do NOT take ANY other action (no searching, no reading files, no answering questions, no code analysis) until the user confirms.**

1. Summarize the pointed elements concisely: include page URL, userNote, and for each element its component name, source file, and tag.
2. Confirm with user via \`AskUserQuestion\`:
   - If \`userNote\` is non-empty → use AskUserQuestion with question "用户备注为「{userNote}」，是否继续？", options: "继续" (description: "按备注内容执行操作") and "取消" (description: "不做任何操作").
   - If \`userNote\` is empty → use AskUserQuestion with question "你想对这些元素做什么？", options: "自定义操作" (description: "输入具体操作指令") and "取消" (description: "不做任何操作").
3. **STOP HERE. Do NOT read files, search code, or perform any action. Wait for user selection.**
4. If user selects "取消" → respond "已取消" and end. Do NOT proceed.`;

const GET_MODE_JOYCODE = `### GET mode (read-only preview)

⚠️ **CRITICAL: In GET mode, after summarizing elements you MUST ask the user for confirmation via task_ask_question. Do NOT take ANY other action (no searching, no reading files, no answering questions, no code analysis) until the user confirms.**

1. Summarize the pointed elements concisely: include page URL, userNote, and for each element its component name, source file, and tag.
2. Confirm with user via \`task_ask_question\`:
   - If \`userNote\` is non-empty → use task_ask_question with question "用户备注为「{userNote}」，是否继续？", options: "继续" (description: "按备注内容执行操作") and "取消" (description: "不做任何操作").
   - If \`userNote\` is empty → use task_ask_question with question "你想对这些元素做什么？", options: "自定义操作" (description: "输入具体操作指令") and "取消" (description: "不做任何操作").
3. **STOP HERE. Do NOT read files, search code, or perform any action. Wait for user selection.**
4. If user selects "取消" → respond "已取消" and end. Do NOT proceed.`;

const GET_MODE_CURSOR = `### GET mode (read-only preview)

⚠️ **CRITICAL: In GET mode, after summarizing elements you MUST ask the user for confirmation via ask_question. Do NOT take ANY other action (no searching, no reading files, no answering questions, no code analysis) until the user confirms.**

1. Summarize the pointed elements concisely: include page URL, userNote, and for each element its component name, source file, and tag.
2. Confirm with user via \`ask_question\`:
   - If \`userNote\` is non-empty → use ask_question with question "用户备注为「{userNote}」，是否继续？", options: "继续" (description: "按备注内容执行操作") and "取消" (description: "不做任何操作").
   - If \`userNote\` is empty → use ask_question with question "你想对这些元素做什么？", options: "自定义操作" (description: "输入具体操作指令") and "取消" (description: "不做任何操作").
3. **STOP HERE. Do NOT read files, search code, or perform any action. Wait for user selection.**
4. If user selects "取消" → respond "已取消" and end. Do NOT proceed.`;

const GET_MODE_OPENCODE = `### GET mode (read-only preview)

⚠️ **CRITICAL: In GET mode, after summarizing elements you MUST ask the user for confirmation via AskUserQuestion. Do NOT take ANY other action (no searching, no reading files, no answering questions, no code analysis) until the user confirms.**

1. Summarize the pointed elements concisely: include page URL, userNote, and for each element its component name, source file, and tag.
2. Confirm with user via \`AskUserQuestion\`:
   - If \`userNote\` is non-empty → use AskUserQuestion with question "用户备注为「{userNote}」，是否继续？", options: "继续" (description: "按备注内容执行操作") and "取消" (description: "不做任何操作").
   - If \`userNote\` is empty → use AskUserQuestion with question "你想对这些元素做什么？", options: "自定义操作" (description: "输入具体操作指令") and "取消" (description: "不做任何操作").
3. **STOP HERE. Do NOT read files, search code, or perform any action. Wait for user selection.**
4. If user selects "取消" → respond "已取消" and end. Do NOT proceed.`;

const GET_MODE_CODEX = `### GET mode (read-only preview)

⚠️ **CRITICAL: In GET mode, after summarizing elements you MUST ask the user for confirmation via request_user_input. Do NOT take ANY other action (no searching, no reading files, no answering questions, no code analysis) until the user confirms.**

1. Summarize the pointed elements concisely: include page URL, userNote, and for each element its component name, source file, and tag.
2. Confirm with user via \`request_user_input\`:
   - If \`userNote\` is non-empty → use request_user_input with question "用户备注为「{userNote}」，是否继续？", options: "继续" (description: "按备注内容执行操作") and "取消" (description: "不做任何操作").
   - If \`userNote\` is empty → use request_user_input with question "你想对这些元素做什么？", options: "自定义操作" (description: "输入具体操作指令") and "取消" (description: "不做任何操作").
3. **STOP HERE. Do NOT read files, search code, or perform any action. Wait for user selection.**
4. If user selects "取消" → respond "已取消" and end. Do NOT proceed.`;

function buildBody(getMode: string): string {
  return `# /pointed

${FAST_PATH_RULE}

## Step 1 — Determine mode BEFORE calling the tool

**If the first arg is "get"** → you are in **GET mode (read-only, NO file modifications allowed)**.
**If the first arg is "history" or "list"** → you are in **HISTORY mode (read-only list)**.
**If the first arg is "use" plus a selectionId** → you are in **HISTORY EXECUTE mode**.
**If the first arg is "clear"** → you are in **CLEAR mode**.
**Otherwise** → you are in **EXECUTE mode**.

Remember which mode you are in. This decision is FINAL and cannot change after the tool call.

## Step 2 — Call the tool

- EXECUTE mode: call \`get-pointed-element\` IMMEDIATELY with no questions.
- GET mode: call \`get-pointed-element\` IMMEDIATELY with no questions.
- HISTORY mode: follow the HISTORY mode tool call rules below.

Parse optional trailing integers as textDetail/cssLevel; if absent, pass NO arguments.

## Step 3 — Act according to mode

---

${HISTORY_MODE}

${getMode}

### EXECUTE mode (default)

1. ${ELEMENT_READING}
2. If \`userNote\` is non-empty → execute the requested changes in source code immediately. Do NOT ask for confirmation.
   If \`userNote\` is empty → ask: "你想对这些元素做什么？" and wait for the user's reply before doing anything.

Text after \`/pointed\` (excluding "get") is a refinement of \`userNote\`.

${PARAM_HINT}

${NO_SELECTION_HINT}
`;
}

const BODY = buildBody(GET_MODE_GENERIC);
const BODY_CLAUDE = buildBody(GET_MODE_CLAUDE);
const BODY_JOYCODE = buildBody(GET_MODE_JOYCODE);
const BODY_CURSOR = buildBody(GET_MODE_CURSOR);
const BODY_OPENCODE = buildBody(GET_MODE_OPENCODE);
const BODY_CODEX = buildBody(GET_MODE_CODEX);

// --- Slash command ---

export const COMMAND_DESCRIPTION = "Fetch the user's pointed elements (Option+Click in browser) and act on their note.";

export const COMMAND_BODY = BODY;

// --- Skill (same content, different install mechanism) ---

export const SKILL_DESCRIPTION = COMMAND_DESCRIPTION;

export const SKILL_BODY = BODY;

// --- Claude Code specific (with AskUserQuestion support) ---

export const COMMAND_BODY_CLAUDE = BODY_CLAUDE;

export const SKILL_BODY_CLAUDE = BODY_CLAUDE;

// --- JoyCode specific (with task_ask_question support) ---

export const COMMAND_BODY_JOYCODE = BODY_JOYCODE;

export const SKILL_BODY_JOYCODE = BODY_JOYCODE;

// --- Cursor specific (with ask_question support) ---

export const COMMAND_BODY_CURSOR = BODY_CURSOR;

export const SKILL_BODY_CURSOR = BODY_CURSOR;

// --- OpenCode specific (with AskUserQuestion support) ---

export const COMMAND_BODY_OPENCODE = BODY_OPENCODE;

// --- Codex specific (with request_user_input support) ---

export const SKILL_BODY_CODEX = BODY_CODEX;
