import path from 'path';
import os from 'os';
import type { ToolAdapter, OperationResult, Scope } from '../types';
import {
  writeFileEnsuringDir,
  readJsonOrDefault,
  fileExists,
  deleteFileIfExists,
  removeJsonKey,
} from '../adapter-helpers';
import {
  TRIGGER_NAME,
  COMMAND_DESCRIPTION,
  COMMAND_BODY,
  SKILL_DESCRIPTION,
  SKILL_BODY,
} from '../trigger-content';

const MCP_SERVER_NAME = 'pointer';
const PROMPT_NAME = 'pointerPointed';
const POINTER_PREFIX = 'pointer';

function pointerEntry(port: number) {
  return {
    command: 'npx',
    args: ['-y', '@mcp-pointer/server@latest', 'start'],
    env: { MCP_POINTER_PORT: String(port) },
  };
}

function buildPromptEntry() {
  return {
    label: 'pointed',
    name: PROMPT_NAME,
    description: COMMAND_DESCRIPTION,
    prompt: COMMAND_BODY,
    source: 'project' as const,
  };
}

function buildSkillFile(): string {
  return `---
name: ${TRIGGER_NAME}
description: ${JSON.stringify(SKILL_DESCRIPTION)}
---

${SKILL_BODY}`;
}

export const joycodeAdapter: ToolAdapter = {
  toolId: 'joycode',
  displayName: 'JoyCode',

  async registerMcp(scope, port): Promise<OperationResult> {
    const filePath = scope === 'user'
      ? path.join(os.homedir(), '.joycode', 'joycode-mcp.json')
      : path.join(process.cwd(), '.joycode', 'mcp.json');
    try {
      const existing = await readJsonOrDefault<Record<string, any>>(filePath, {});
      const existingServers = (existing.mcpServers && typeof existing.mcpServers === 'object')
        ? existing.mcpServers : {};
      const merged = {
        ...existing,
        mcpServers: {
          ...existingServers,
          [MCP_SERVER_NAME]: pointerEntry(port),
        },
      };
      await writeFileEnsuringDir(filePath, JSON.stringify(merged, null, 2));
      return {
        status: 'success', scope, path: filePath, message: 'MCP server merged into JoyCode config',
      };
    } catch (e) {
      return { status: 'failed', scope, message: `Write failed: ${(e as Error).message}` };
    }
  },

  async installCommand(scope): Promise<OperationResult> {
    // JoyCode prompt.json entries are slash commands; project-level only.
    const isDegraded = scope === 'user';
    const effectiveScope: Scope = 'project';
    const filePath = path.join(process.cwd(), '.joycode', 'prompt.json');
    try {
      const existing = await readJsonOrDefault<any[]>(filePath, []);
      const arr = Array.isArray(existing) ? existing : [];
      const filtered = arr.filter((e) => !(e && typeof e === 'object'
          && typeof (e as any).name === 'string'
          && (e as any).name.startsWith(POINTER_PREFIX)));
      const next = [...filtered, buildPromptEntry()];
      await writeFileEnsuringDir(filePath, JSON.stringify(next, null, 2));
      return {
        status: isDegraded ? 'degraded' : 'success',
        scope: effectiveScope,
        path: filePath,
        message: isDegraded
          ? 'JoyCode only supports project-level prompts; installed at project scope.'
          : 'Slash command merged into .joycode/prompt.json',
      };
    } catch (e) {
      return {
        status: 'failed',
        scope: effectiveScope,
        message: `Write failed: ${(e as Error).message}`,
      };
    }
  },

  async installSkill(scope): Promise<OperationResult> {
    const base = scope === 'user' ? os.homedir() : process.cwd();
    const filePath = path.join(base, '.joycode', 'skills', TRIGGER_NAME, 'SKILL.md');
    try {
      await writeFileEnsuringDir(filePath, buildSkillFile());
      return {
        status: 'success', scope, path: filePath, message: 'Skill installed',
      };
    } catch (e) {
      return { status: 'failed', scope, message: `Write failed: ${(e as Error).message}` };
    }
  },

  async unregisterMcp(scope): Promise<OperationResult> {
    const filePath = scope === 'user'
      ? path.join(os.homedir(), '.joycode', 'joycode-mcp.json')
      : path.join(process.cwd(), '.joycode', 'mcp.json');
    if (!(await fileExists(filePath))) {
      return {
        status: 'skipped', scope, path: filePath, message: 'JoyCode MCP config not found',
      };
    }
    try {
      const existing = await readJsonOrDefault<Record<string, any>>(filePath, {});
      const removed = removeJsonKey(existing, ['mcpServers', MCP_SERVER_NAME]);
      if (!removed) {
        return {
          status: 'skipped', scope, path: filePath, message: 'pointer entry not present',
        };
      }
      await writeFileEnsuringDir(filePath, JSON.stringify(existing, null, 2));
      return {
        status: 'success', scope, path: filePath, message: 'pointer entry removed',
      };
    } catch (e) {
      return { status: 'failed', scope, message: `Edit failed: ${(e as Error).message}` };
    }
  },

  async uninstallCommand(scope): Promise<OperationResult> {
    const isDegraded = scope === 'user';
    const effectiveScope: Scope = 'project';
    const filePath = path.join(process.cwd(), '.joycode', 'prompt.json');
    if (!(await fileExists(filePath))) {
      return {
        status: 'skipped', scope: effectiveScope, path: filePath, message: 'prompt.json not found',
      };
    }
    try {
      const existing = await readJsonOrDefault<any[]>(filePath, []);
      const arr = Array.isArray(existing) ? existing : [];
      const filtered = arr.filter((e) => !(e && typeof e === 'object'
          && typeof (e as any).name === 'string'
          && (e as any).name.startsWith(POINTER_PREFIX)));
      if (filtered.length === arr.length) {
        return {
          status: 'skipped',
          scope: effectiveScope,
          path: filePath,
          message: 'No pointer-prefixed prompts present',
        };
      }
      await writeFileEnsuringDir(filePath, JSON.stringify(filtered, null, 2));
      return {
        status: isDegraded ? 'degraded' : 'success',
        scope: effectiveScope,
        path: filePath,
        message: isDegraded
          ? 'JoyCode prompts live at project scope; removed there.'
          : 'pointer-prefixed prompts removed',
      };
    } catch (e) {
      return {
        status: 'failed', scope: effectiveScope, message: `Edit failed: ${(e as Error).message}`,
      };
    }
  },

  async uninstallSkill(scope): Promise<OperationResult> {
    const base = scope === 'user' ? os.homedir() : process.cwd();
    const filePath = path.join(base, '.joycode', 'skills', TRIGGER_NAME, 'SKILL.md');
    try {
      const r = await deleteFileIfExists(filePath);
      return r === 'deleted'
        ? {
          status: 'success', scope, path: filePath, message: 'Skill removed',
        }
        : {
          status: 'skipped', scope, path: filePath, message: 'Skill file not found',
        };
    } catch (e) {
      return { status: 'failed', scope, message: `Delete failed: ${(e as Error).message}` };
    }
  },
};
