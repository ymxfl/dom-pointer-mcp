// Shared name for both command and skill
export const TRIGGER_NAME = 'pointed';

// --- Slash command (打 /pointed 触发) ---
export const COMMAND_DESCRIPTION =
  "Fetch the user's currently pointed elements (set in browser via Option+Click) "
  + 'and act on their note. Any text after /pointed is treated as a refinement.';

export const COMMAND_BODY = `Call \`mcp__pointer__get-pointed-element\`. The returned payload has \`userNote\` (the user's primary instruction, typed in the browser before sending) and \`elements[]\` (DOM info per element). Treat \`userNote\` as the primary instruction and use \`elements[]\` to locate source files.

If the user typed extra text after \`/pointed\`, treat it as a refinement or follow-up to \`userNote\`.

If the tool returns "No selection pointed", tell the user to Option+Click elements in the browser, write a note, and press Cmd/Ctrl+Enter or Send.
`;

// --- Description-triggered skill (用户随口说话也命中) ---
export const SKILL_DESCRIPTION =
  'When the user issues a short request about elements they have selected in the '
  + 'browser via Option+Click (e.g. "做一下", "pointed", "改一下选中的", "看看选中的"), '
  + 'IMMEDIATELY call mcp__pointer__get-pointed-element without first asking for '
  + "clarification. The returned payload has userNote (the user's actual request) and "
  + 'elements[] (DOM info per element including selector, cssProperties, and componentInfo '
  + 'with source file). Treat userNote as the primary instruction and use elements[] to '
  + 'locate the source code.';

export const SKILL_BODY = `# Pointed elements trigger

When the user issues a short request like "做一下", "pointed", "改一下选中的", or any
brief instruction about what they have selected in their browser, you MUST:

1. Call the MCP tool \`mcp__pointer__get-pointed-element\` FIRST. Do not ask for
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
`;
