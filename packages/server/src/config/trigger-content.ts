// Shared name for both command and skill
export const TRIGGER_NAME = 'pointed';

// --- Shared fragments ---

const PARAM_HINT = `Trailing integers 0-3 set textDetail and cssLevel positionally:
- \`/pointed 0 0\` → \`{ textDetail: 0, cssLevel: 0 }\`
- \`/pointed 1 2\` → \`{ textDetail: 1, cssLevel: 2 }\`
Strip them from the user's note before treating remaining text as instructions.`;

const ELEMENT_READING = `Read the returned payload:
- \`userNote\`: the user's primary instruction
- \`elements[]\`: DOM info per element (selector, componentInfo.sourceFile, cssProperties, url)
- Reference elements by 1-based index when user uses [1], [2] notation`;

const NO_SELECTION_HINT = 'If the tool returns "No selection pointed", tell the user to Option+Click elements in the browser and press Cmd/Ctrl+Enter before retrying.';

const BODY = `# /pointed

## Routing

**If the first arg is "get"** → follow the GET section below.
**Otherwise** → follow the EXECUTE section below.

---

## GET (read-only)

Usage: \`/pointed get [textDetail] [cssLevel]\`

1. Call \`get-pointed-element\` with parsed params (defaults: textDetail=2, cssLevel=1).
2. Summarize: page URL, element count, per-element tag/selector/component.
3. If \`userNote\` is non-empty → ask: "用户备注为「{userNote}」，是否执行？"
   If empty → ask: "你想对这些元素做什么？"
4. **STOP. Do NOT modify any file until the user explicitly confirms.**

---

## EXECUTE (default)

1. Call \`get-pointed-element\` immediately — do not ask first.
2. ${ELEMENT_READING}
3. Make the requested changes in source code.

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
