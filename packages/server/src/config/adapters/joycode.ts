import path from 'path';
import os from 'os';
import type {
  ToolAdapter, OperationResult, Scope, LaunchMode,
} from '../types';
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
  COMMAND_BODY_JOYCODE,
  SKILL_DESCRIPTION,
  SKILL_BODY_JOYCODE,
} from '../trigger-content';

const MCP_SERVER_NAME = 'dom-pointer';
const PROMPT_NAME = 'pointerPointed';
const POINTER_PREFIX = 'pointer';

function pointerEntry(port: number, launchMode: LaunchMode = 'npx') {
  if (launchMode === 'global') {
    return {
      command: 'dom-pointer-mcp',
      args: ['start'],
      env: { MCP_POINTER_PORT: String(port) },
    };
  }
  return {
    command: 'npx',
    args: ['-y', '@dom-pointer-mcp/server@latest', 'start'],
    env: { MCP_POINTER_PORT: String(port) },
  };
}

function buildPromptEntry(scope: Scope) {
  return {
    label: 'pointed',
    name: PROMPT_NAME,
    description: COMMAND_DESCRIPTION,
    prompt: COMMAND_BODY_JOYCODE,
    source: scope,
  };
}

function buildSkillFile(): string {
  return `---
name: ${TRIGGER_NAME}
description: ${JSON.stringify(SKILL_DESCRIPTION)}
---

${SKILL_BODY_JOYCODE}`;
}

export const joycodeAdapter: ToolAdapter = {
  toolId: 'joycode',
  displayName: 'JoyCode',

  async registerMcp(scope, port, launchMode: LaunchMode = 'npx'): Promise<OperationResult> {
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
          [MCP_SERVER_NAME]: pointerEntry(port, launchMode),
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
    const filePath = scope === 'user'
      ? path.join(os.homedir(), '.joycode', 'prompt.json')
      : path.join(process.cwd(), '.joycode', 'prompt.json');
    try {
      const existing = await readJsonOrDefault<any[]>(filePath, []);
      const arr = Array.isArray(existing) ? existing : [];
      const filtered = arr.filter((e) => !(e && typeof e === 'object'
          && typeof (e as any).name === 'string'
          && (e as any).name.startsWith(POINTER_PREFIX)));
      const next = [...filtered, buildPromptEntry(scope)];
      await writeFileEnsuringDir(filePath, JSON.stringify(next, null, 2));
      return {
        status: 'success',
        scope,
        path: filePath,
        message: 'Slash command merged into prompt.json',
      };
    } catch (e) {
      return {
        status: 'failed',
        scope,
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
    const filePath = scope === 'user'
      ? path.join(os.homedir(), '.joycode', 'prompt.json')
      : path.join(process.cwd(), '.joycode', 'prompt.json');
    if (!(await fileExists(filePath))) {
      return {
        status: 'skipped', scope, path: filePath, message: 'prompt.json not found',
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
          scope,
          path: filePath,
          message: 'No pointer-prefixed prompts present',
        };
      }
      await writeFileEnsuringDir(filePath, JSON.stringify(filtered, null, 2));
      return {
        status: 'success',
        scope,
        path: filePath,
        message: 'pointer-prefixed prompts removed',
      };
    } catch (e) {
      return {
        status: 'failed', scope, message: `Edit failed: ${(e as Error).message}`,
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
