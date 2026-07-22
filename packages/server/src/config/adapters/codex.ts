import path from 'path';
import os from 'os';
import type {
  ToolAdapter, OperationResult, Scope, LaunchMode,
} from '../types';
import {
  writeFileEnsuringDir,
  readTextOrEmpty,
  fileExists,
  deleteDirIfExists,
} from '../adapter-helpers';
import {
  TRIGGER_NAME,
  SKILL_DESCRIPTION,
  SKILL_BODY,
} from '../trigger-content';

const MCP_SERVER_NAME = 'dom-pointer';

function buildTomlSection(port: number, launchMode: LaunchMode = 'npx'): string {
  const cmd = launchMode === 'global' ? 'dom-pointer-mcp' : 'npx';
  const args = launchMode === 'global'
    ? '["start"]'
    : '["-y", "--registry=https://registry.npmjs.org/", "@dom-pointer-mcp/server@latest", "start"]';
  return `[mcp_servers.${MCP_SERVER_NAME}]
command = "${cmd}"
args = ${args}

[mcp_servers.${MCP_SERVER_NAME}.env]
MCP_POINTER_PORT = "${port}"
`;
}

function mergeToml(existing: string, port: number, launchMode: LaunchMode = 'npx'): string {
  const section = buildTomlSection(port, launchMode);
  const headerRe = /^\[mcp_servers\.dom-pointer(?:\.[\w-]+)?\]/m;
  if (!headerRe.test(existing)) {
    const trimmed = existing.trimEnd();
    const prefix = trimmed.length > 0 ? `${trimmed}\n\n` : '';
    return `${prefix}${section}`;
  }
  const lines = existing.split('\n');
  const result: string[] = [];
  let i = 0;
  let inserted = false;
  while (i < lines.length) {
    const line = lines[i];
    if (/^\[mcp_servers\.dom-pointer(?:\.[\w-]+)?\]/.test(line.trim())) {
      i += 1;
      while (i < lines.length) {
        const t = lines[i].trim();
        if (/^\[/.test(t) && !/^\[mcp_servers\.dom-pointer(?:\.[\w-]+)?\]/.test(t)) break;
        i += 1;
      }
      if (!inserted) {
        result.push(...section.split('\n'));
        inserted = true;
      }
    } else {
      result.push(line);
      i += 1;
    }
  }
  return result.join('\n');
}

function stripPointerToml(existing: string): { changed: boolean; next: string } {
  const headerRe = /^\s*\[mcp_servers\.dom-pointer(?:\.[\w-]+)?\]\s*$/;
  const otherHeaderRe = /^\s*\[/;
  const lines = existing.split('\n');
  const out: string[] = [];
  let changed = false;
  let i = 0;
  while (i < lines.length) {
    if (headerRe.test(lines[i])) {
      changed = true;
      i += 1;
      while (i < lines.length && !otherHeaderRe.test(lines[i])) i += 1;
    } else {
      out.push(lines[i]);
      i += 1;
    }
  }
  // collapse runs of >=3 blank lines that the removal can create
  const collapsed = out.join('\n').replace(/\n{3,}/g, '\n\n');
  return { changed, next: collapsed };
}

function buildSkillFile(): string {
  return `---
name: ${TRIGGER_NAME}
description: ${JSON.stringify(SKILL_DESCRIPTION)}
---

${SKILL_BODY}`;
}

export const codexAdapter: ToolAdapter = {
  toolId: 'codex',
  displayName: 'Codex CLI',

  async registerMcp(scope, port, launchMode: LaunchMode = 'npx'): Promise<OperationResult> {
    const base = scope === 'user' ? os.homedir() : process.cwd();
    const filePath = path.join(base, '.codex', 'config.toml');
    try {
      const existing = await readTextOrEmpty(filePath);
      const merged = mergeToml(existing, port, launchMode);
      await writeFileEnsuringDir(filePath, merged);
      return {
        status: 'success',
        scope,
        path: filePath,
        message: 'MCP server section merged into config.toml',
      };
    } catch (e) {
      return { status: 'failed', scope, message: `Write failed: ${(e as Error).message}` };
    }
  },

  async installSkill(scope): Promise<OperationResult> {
    // Codex skills live under ~/.codex/skills, user-only.
    const filePath = path.join(os.homedir(), '.codex', 'skills', TRIGGER_NAME, 'SKILL.md');
    const isDegraded = scope === 'project';
    const effectiveScope: Scope = 'user';
    try {
      await writeFileEnsuringDir(filePath, buildSkillFile());
      return {
        status: isDegraded ? 'degraded' : 'success',
        scope: effectiveScope,
        path: filePath,
        message: isDegraded
          ? 'Codex only supports user-level skills; installed at user scope instead.'
          : 'Skill installed',
      };
    } catch (e) {
      return {
        status: 'failed',
        scope: effectiveScope,
        message: `Write failed: ${(e as Error).message}`,
      };
    }
  },
  // No installCommand: Codex no longer supports prompts-based slash commands.

  async unregisterMcp(scope): Promise<OperationResult> {
    const base = scope === 'user' ? os.homedir() : process.cwd();
    const filePath = path.join(base, '.codex', 'config.toml');
    if (!(await fileExists(filePath))) {
      return {
        status: 'skipped', scope, path: filePath, message: 'config.toml not found',
      };
    }
    try {
      const existing = await readTextOrEmpty(filePath);
      const { changed, next } = stripPointerToml(existing);
      if (!changed) {
        return {
          status: 'skipped', scope, path: filePath, message: '[mcp_servers.dom-pointer] not present',
        };
      }
      await writeFileEnsuringDir(filePath, next);
      return {
        status: 'success',
        scope,
        path: filePath,
        message: '[mcp_servers.dom-pointer] removed from config.toml',
      };
    } catch (e) {
      return { status: 'failed', scope, message: `Edit failed: ${(e as Error).message}` };
    }
  },

  async uninstallSkill(scope): Promise<OperationResult> {
    const dirPath = path.join(os.homedir(), '.codex', 'skills', TRIGGER_NAME);
    const isDegraded = scope === 'project';
    const effectiveScope: Scope = 'user';
    try {
      const r = await deleteDirIfExists(dirPath);
      if (r === 'missing') {
        return {
          status: 'skipped',
          scope: effectiveScope,
          path: dirPath,
          message: 'Skill directory not found',
        };
      }
      return {
        status: isDegraded ? 'degraded' : 'success',
        scope: effectiveScope,
        path: dirPath,
        message: isDegraded
          ? 'Codex skills live at user scope; skill removed there.'
          : 'Skill removed',
      };
    } catch (e) {
      return {
        status: 'failed',
        scope: effectiveScope,
        message: `Delete failed: ${(e as Error).message}`,
      };
    }
  },
  // No uninstallCommand: Codex no longer supports prompts-based slash commands.
};
