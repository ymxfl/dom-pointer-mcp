// Shared name for both command and skill
export const TRIGGER_NAME = 'pointed';

// Shared explanation of the textDetail / cssLevel positional shortcut.
// Same wording for command and skill so users learn one convention.
const DETAIL_PARAMS_CONVENTION = `## Payload-size shortcut

\`get-pointed-element\` accepts two optional integer parameters:
- \`textDetail\`: 0 (no text) | 1 (visible only) | 2 (full, default)
- \`cssLevel\`: 0 (no CSS) | 1 (layout) | 2 (+ box model) | 3 (full computed, default)

If the user's message ends with **one or two integers in the range 0-3** (space
separated, e.g. \`0 0\`, \`1 2\`, or just \`1\`), treat them as positional values for
\`textDetail\` and \`cssLevel\` and pass them to the tool. Examples:
- \`/pointed 0 0\` → call tool with \`{ textDetail: 0, cssLevel: 0 }\`
- \`/pointed 1\` → call tool with \`{ textDetail: 1 }\`
- \`做一下 0 1\` → call tool with \`{ textDetail: 0, cssLevel: 1 }\`

The numeric tail is configuration, NOT a refinement — strip it from the user's
note before treating any remaining text as instructions. If no such trailing
numbers are present, call the tool with no arguments.`;

// --- Subcommand: /pointed get ---
const SUBCOMMAND_GET = `## Subcommand: \`/pointed get\`

Usage:
- \`/pointed get\` — call with defaults (textDetail=2, cssLevel=0)
- \`/pointed get 2 2\` — call with textDetail=2, cssLevel=2
- \`/pointed get 1 3\` — call with textDetail=1, cssLevel=3

Arguments are positional: first number is \`textDetail\`, second is \`cssLevel\`.

Behavior:

1. Parse optional textDetail and cssLevel from args after "get".
2. Call \`mcp__dom-pointer__get-pointed-element\` with those parameters.
3. Summarize the returned data to the user in natural language:
   - Page URL
   - Number of elements selected
   - Per element: tag, selector, component name (if available)
   - \`userNote\` content (if present)
4. After presenting the summary:
   - If \`userNote\` is non-empty → ask user: "用户备注为「{userNote}」，是否执行？"
   - If \`userNote\` is empty → ask user: "你想对这些元素做什么？"
5. Wait for user confirmation or instruction before taking any action.`;

// --- Slash command (打 /pointed 触发) ---
export const COMMAND_DESCRIPTION = "Fetch the user's currently pointed elements (set in browser via Option+Click) "
  + 'and act on their note. Any text after /pointed is treated as a refinement; '
  + 'trailing integers 0-3 (e.g. `/pointed 0 0`) set textDetail and cssLevel.';

export const COMMAND_BODY = `# /pointed

The user has selected one or more elements in their browser via Option+Click
and is asking you to act on them. You MUST:

1. Call the MCP tool \`mcp__dom-pointer__get-pointed-element\` FIRST. Do not ask for
   clarification before calling — the tool returns the user's actual instructions.
2. Read \`userNote\` as the primary instruction (typed in the browser before sending).
3. Read \`elements[]\` for each selected DOM element:
   - \`selector\`: CSS selector
   - \`componentInfo.name\` + \`componentInfo.sourceFile\`: source file to edit
   - \`cssProperties\`: current computed styles
   - \`url\`: page where the element lives
4. Make the requested changes in source code. Reference elements by their array
   index (1-based) when the user uses \`[1]\`, \`[2]\` notation in their note.

If the user typed extra text after \`/pointed\`, treat it as a refinement or
follow-up to \`userNote\`.

If \`get-pointed-element\` returns "No selection pointed", inform the user to
Option+Click elements in the browser, write a note, and press Cmd/Ctrl+Enter
or Send before retrying.

${DETAIL_PARAMS_CONVENTION}

${SUBCOMMAND_GET}
`;

// --- Description-triggered skill (用户随口说话也命中) ---
export const SKILL_DESCRIPTION = 'When the user issues a short request about elements they have selected in the '
  + 'browser via Option+Click (e.g. "做一下", "pointed", "改一下选中的", "看看选中的"), '
  + 'IMMEDIATELY call mcp__dom-pointer__get-pointed-element without first asking for '
  + "clarification. The returned payload has userNote (the user's actual request) and "
  + 'elements[] (DOM info per element including selector, cssProperties, and componentInfo '
  + 'with source file). Treat userNote as the primary instruction and use elements[] to '
  + 'locate the source code. Trailing integers 0-3 in the user message (e.g. "做一下 0 0") '
  + 'are positional textDetail/cssLevel parameters for the tool.';

export const SKILL_BODY = `# Pointed elements trigger

When the user issues a short request like "做一下", "pointed", "改一下选中的", or any
brief instruction about what they have selected in their browser, you MUST:

1. Call the MCP tool \`mcp__dom-pointer__get-pointed-element\` FIRST. Do not ask for
   clarification before calling — the tool returns the user's actual instructions.
2. Read \`userNote\` as the primary instruction.
3. Read \`elements[]\` for each selected DOM element:
   - \`selector\`: CSS selector
   - \`componentInfo.name\` + \`componentInfo.sourceFile\`: source file to edit
   - \`cssProperties\`: current computed styles
   - \`url\`: page where the element lives
4. Make the requested changes in source code. Reference elements by their array
   index (1-based) when the user uses \`[1]\`, \`[2]\` notation in their note.

If \`get-pointed-element\` returns "No selection pointed", inform the user to
Option+Click elements in the browser, write a note, and press Cmd/Ctrl+Enter
or Send before retrying.

${DETAIL_PARAMS_CONVENTION}

${SUBCOMMAND_GET}
`;
