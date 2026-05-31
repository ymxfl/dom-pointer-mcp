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
- \`elements[]\`: DOM info per element (selector, componentInfo.sourceFile, cssProperties, url)
- Reference elements by 1-based index when user uses [1], [2] notation`;

const NO_SELECTION_HINT = 'If the tool returns "No selection pointed", tell the user to Option+Click elements in the browser and press Cmd/Ctrl+Enter before retrying.';

const BODY = `# /pointed

## Step 1 — Always call the tool first

Regardless of mode, call \`get-pointed-element\` IMMEDIATELY with no questions.
Parse optional trailing integers as textDetail/cssLevel; if absent, pass NO arguments.

## Step 2 — Route by mode

**If the first arg is "get"** → GET mode.
**Otherwise** → EXECUTE mode.

---

### GET mode (read-only preview)

1. Summarize: page URL, element count, per-element tag/selector/component.
2. If \`userNote\` is non-empty → ask: "用户备注为「{userNote}」，是否执行？"
   If \`userNote\` is empty → ask: "你想对这些元素做什么？"
3. **STOP. Wait for user reply. Do NOT modify any file until user explicitly says yes.**

### EXECUTE mode (default)

1. ${ELEMENT_READING}
2. If \`userNote\` is non-empty → execute the requested changes in source code immediately. Do NOT ask for confirmation.
   If \`userNote\` is empty → ask: "你想对这些元素做什么？" and wait for the user's reply before doing anything.

Text after \`/pointed\` (excluding "get") is a refinement of \`userNote\`.

${PARAM_HINT}

${NO_SELECTION_HINT}
`;

// --- Slash command ---

export const COMMAND_DESCRIPTION = "Fetch the user's pointed elements (Option+Click in browser) and act on their note.";

export const COMMAND_BODY = BODY;

// --- Skill (same content, different install mechanism) ---

export const SKILL_DESCRIPTION = COMMAND_DESCRIPTION;

export const SKILL_BODY = BODY;
