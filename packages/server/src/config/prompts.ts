import {
  checkbox, confirm, select,
} from '@inquirer/prompts';
import type { Scope, ToolAdapter, ToolId } from './types';

export type Action = 'install' | 'uninstall';

function ensureTTY(): void {
  if (!process.stdin.isTTY) {
    throw new Error(
      'Interactive mode requires a TTY. Pass a tool name and --scope explicitly '
      + '(e.g. `dom-pointer-mcp config claude --scope user`).',
    );
  }
}

export async function selectAction(): Promise<Action> {
  ensureTTY();
  return select<Action>({
    message: 'What do you want to do?',
    choices: [
      { name: 'Install — set up DOM Pointer MCP for one or more agents', value: 'install' },
      { name: 'Uninstall — remove DOM Pointer MCP from one or more agents', value: 'uninstall' },
    ],
  });
}

export async function selectAgents(
  adapters: ToolAdapter[],
  message: string,
): Promise<ToolAdapter[]> {
  ensureTTY();
  const selectedIds = await checkbox<ToolId>({
    message,
    choices: adapters.map((a) => ({ name: a.displayName, value: a.toolId })),
    validate: (items) => (items.length === 0 ? 'Select at least one agent (space to toggle).' : true),
  });
  const byId = new Map(adapters.map((a) => [a.toolId, a]));
  return selectedIds.map((id) => byId.get(id)!).filter(Boolean);
}

export async function selectScope(): Promise<Scope> {
  ensureTTY();
  return select<Scope>({
    message: 'Install scope:',
    choices: [
      { name: 'user — global, all projects', value: 'user' },
      { name: 'project — current directory only', value: 'project' },
    ],
  });
}

export async function confirmSlash(): Promise<boolean> {
  ensureTTY();
  return confirm({
    message: 'Also install the slash command for the selected agents?',
    default: true,
  });
}

export async function confirmUninstall(agentNames: string[]): Promise<boolean> {
  ensureTTY();
  return confirm({
    message:
      `This will remove user-scope MCP entries, skills, and slash commands for: ${agentNames.join(', ')}.\n`
      + '  Project-scope installs must be removed manually.\n'
      + '  Continue?',
    default: false,
  });
}
