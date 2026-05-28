import path from 'path';
import os from 'os';
import type { ToolAdapter, OperationResult, Scope } from '../types';
import { writeFileEnsuringDir, readTextOrEmpty } from '../adapter-helpers';
import { TRIGGER_NAME, TRIGGER_DESCRIPTION, TRIGGER_BODY } from '../trigger-content';

const MCP_SERVER_NAME = 'pointer';

function buildTomlSection(port: number): string {
  return `[mcp_servers.${MCP_SERVER_NAME}]
command = "npx"
args = ["-y", "@mcp-pointer/server@latest", "start"]

[mcp_servers.${MCP_SERVER_NAME}.env]
MCP_POINTER_PORT = "${port}"
`;
}

function mergeToml(existing: string, port: number): string {
  const section = buildTomlSection(port);
  const headerRe = /^\[mcp_servers\.pointer(?:\.[\w-]+)?\]/m;
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
    if (/^\[mcp_servers\.pointer(?:\.[\w-]+)?\]/.test(line.trim())) {
      i += 1;
      while (i < lines.length) {
        const t = lines[i].trim();
        if (/^\[/.test(t) && !/^\[mcp_servers\.pointer(?:\.[\w-]+)?\]/.test(t)) break;
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

function buildPromptFile(): string {
  return `---
description: ${JSON.stringify(TRIGGER_DESCRIPTION)}
argument-hint: command arguments
---

${TRIGGER_BODY}`;
}

export const codexAdapter: ToolAdapter = {
  toolId: 'codex',
  displayName: 'Codex CLI',

  async registerMcp(scope, port): Promise<OperationResult> {
    const base = scope === 'user' ? os.homedir() : process.cwd();
    const filePath = path.join(base, '.codex', 'config.toml');
    try {
      const existing = await readTextOrEmpty(filePath);
      const merged = mergeToml(existing, port);
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

  async installTrigger(scope): Promise<OperationResult> {
    const filePath = path.join(os.homedir(), '.codex', 'prompts', `${TRIGGER_NAME}.md`);
    const isDegraded = scope === 'project';
    const effectiveScope: Scope = 'user';
    try {
      await writeFileEnsuringDir(filePath, buildPromptFile());
      return {
        status: isDegraded ? 'degraded' : 'success',
        scope: effectiveScope,
        path: filePath,
        message: isDegraded
          ? 'Codex only supports user-level prompts; installed at user scope instead.'
          : 'Trigger prompt installed',
      };
    } catch (e) {
      return {
        status: 'failed',
        scope: effectiveScope,
        message: `Write failed: ${(e as Error).message}`,
      };
    }
  },
};
