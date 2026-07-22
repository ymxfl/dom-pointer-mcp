import type { ToolAdapter, ToolId } from '../types';
import { claudeAdapter } from './claude';
import { cursorAdapter } from './cursor';
import { windsurfAdapter } from './windsurf';
import { codexAdapter } from './codex';
import { opencodeAdapter } from './opencode';
import { joycodeAdapter } from './joycode';
import { genericAdapter } from './generic';

const ADAPTERS: Record<ToolId, ToolAdapter> = {
  claude: claudeAdapter,
  cursor: cursorAdapter,
  windsurf: windsurfAdapter,
  codex: codexAdapter,
  opencode: opencodeAdapter,
  joycode: joycodeAdapter,
  generic: genericAdapter,
};

export function getAdapter(toolId: string): ToolAdapter | undefined {
  return ADAPTERS[toolId as ToolId];
}

export function listAdapters(): ToolAdapter[] {
  return Object.values(ADAPTERS);
}
