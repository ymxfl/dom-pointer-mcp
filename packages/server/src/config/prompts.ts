import {
  checkbox, confirm, select,
} from '@inquirer/prompts';
import type { Scope, ToolAdapter, ToolId } from './types';
import { resolveDisplayName } from './types';
import { t } from './i18n';

export type Action = 'install' | 'uninstall';
export type LaunchMode = 'npx' | 'global';

function ensureTTY(): void {
  if (!process.stdin.isTTY) {
    throw new Error(t('noTTY') as string);
  }
}

export async function selectAction(): Promise<Action> {
  ensureTTY();
  return select<Action>({
    message: t('selectAction') as string,
    choices: [
      { name: t('actionInstall') as string, value: 'install' },
      { name: t('actionUninstall') as string, value: 'uninstall' },
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
    choices: adapters.map((a) => ({ name: resolveDisplayName(a), value: a.toolId })),
    validate: (items) => (items.length === 0 ? t('agentValidation') as string : true),
  });
  const byId = new Map(adapters.map((a) => [a.toolId, a]));
  return selectedIds.map((id) => byId.get(id)!).filter(Boolean);
}

export async function selectScope(): Promise<Scope> {
  ensureTTY();
  return select<Scope>({
    message: t('selectScope') as string,
    choices: [
      { name: t('scopeUser') as string, value: 'user' },
      { name: t('scopeProject') as string, value: 'project' },
    ],
  });
}

export async function selectLaunchMode(): Promise<LaunchMode> {
  ensureTTY();
  return select<LaunchMode>({
    message: t('selectLaunchMode') as string,
    choices: [
      { name: t('launchModeNpx') as string, value: 'npx' },
      { name: t('launchModeGlobal') as string, value: 'global' },
    ],
  });
}

export async function confirmSlash(): Promise<boolean> {
  ensureTTY();
  return select<boolean>({
    message: t('confirmSlash') as string,
    choices: [
      { name: t('slashYes') as string, value: true },
      { name: t('slashNo') as string, value: false },
    ],
  });
}

export async function confirmUninstall(agentNames: string[]): Promise<boolean> {
  ensureTTY();
  const msgFn = t('confirmUninstall') as (agents: string) => string;
  return confirm({
    message: msgFn(agentNames.join(', ')),
    default: false,
  });
}
