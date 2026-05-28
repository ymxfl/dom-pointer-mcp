import path from 'path';
import os from 'os';
import type { ToolAdapter, OperationResult, Scope } from '../types';
import { writeFileEnsuringDir, readTextOrEmpty, readJsonOrDefault } from '../adapter-helpers';
import {
  TRIGGER_NAME,
  COMMAND_DESCRIPTION,
  COMMAND_BODY,
  SKILL_DESCRIPTION,
  SKILL_BODY,
} from '../trigger-content';

const MCP_SERVER_NAME = 'pointer';
const RULE_BEGIN = '<!-- BEGIN mcp-pointer skill -->';
const RULE_END = '<!-- END mcp-pointer skill -->';

function buildRuleSection(): string {
  return `${RULE_BEGIN}
${SKILL_BODY}
${RULE_END}`;
}

function mergeGlobalRules(existing: string): string {
  const begin = existing.indexOf(RULE_BEGIN);
  if (begin === -1) {
    const trimmed = existing.trimEnd();
    const prefix = trimmed.length > 0 ? `${trimmed}\n\n` : '';
    return `${prefix}${buildRuleSection()}\n`;
  }
  const end = existing.indexOf(RULE_END);
  if (end === -1) {
    return `${existing.substring(0, begin)}${buildRuleSection()}\n`;
  }
  return `${existing.substring(0, begin)}${buildRuleSection()}${existing.substring(end + RULE_END.length)}`;
}

function buildMcpConfig(port: number, existingMcpServers: Record<string, unknown> = {}) {
  return {
    mcpServers: {
      ...existingMcpServers,
      [MCP_SERVER_NAME]: {
        command: 'npx',
        args: ['-y', '@mcp-pointer/server@latest', 'start'],
        env: { MCP_POINTER_PORT: String(port) },
      },
    },
  };
}

function buildWorkflowFile(): string {
  return `---
description: ${JSON.stringify(COMMAND_DESCRIPTION)}
---

${COMMAND_BODY}`;
}

export const windsurfAdapter: ToolAdapter = {
  toolId: 'windsurf',
  displayName: 'Windsurf',

  async registerMcp(scope, port): Promise<OperationResult> {
    const isDegraded = scope === 'project';
    const effectiveScope: Scope = 'user';
    const filePath = path.join(os.homedir(), '.codeium', 'windsurf', 'mcp_config.json');
    try {
      const existing = await readJsonOrDefault<{ mcpServers?: Record<string, unknown> }>(
        filePath, {},
      );
      const merged = buildMcpConfig(port, existing.mcpServers ?? {});
      await writeFileEnsuringDir(filePath, JSON.stringify(merged, null, 2));
      return {
        status: isDegraded ? 'degraded' : 'success',
        scope: effectiveScope,
        path: filePath,
        message: isDegraded
          ? 'Windsurf does not support project-level MCP; installed at user scope instead.'
          : 'MCP server registered at user scope',
      };
    } catch (e) {
      return { status: 'failed', scope: effectiveScope, message: `Write failed: ${(e as Error).message}` };
    }
  },

  async installCommand(scope): Promise<OperationResult> {
    // Windsurf "workflows" are slash commands
    const base = scope === 'user'
      ? path.join(os.homedir(), '.codeium', 'windsurf')
      : path.join(process.cwd(), '.windsurf');
    const filePath = path.join(base, 'workflows', `${TRIGGER_NAME}.md`);
    try {
      await writeFileEnsuringDir(filePath, buildWorkflowFile());
      return {
        status: 'success', scope, path: filePath, message: 'Slash command (workflow) installed',
      };
    } catch (e) {
      return { status: 'failed', scope, message: `Write failed: ${(e as Error).message}` };
    }
  },

  async installSkill(scope): Promise<OperationResult> {
    try {
      if (scope === 'user') {
        const filePath = path.join(os.homedir(), '.codeium', 'windsurf', 'global_rules.md');
        const existing = await readTextOrEmpty(filePath);
        await writeFileEnsuringDir(filePath, mergeGlobalRules(existing));
        return {
          status: 'success', scope, path: filePath,
          message: 'Skill rule appended to global_rules.md',
        };
      }
      const filePath = path.join(process.cwd(), '.windsurf', 'rules', `${TRIGGER_NAME}.md`);
      const ruleFile = `---
description: ${JSON.stringify(SKILL_DESCRIPTION)}
---

${SKILL_BODY}`;
      await writeFileEnsuringDir(filePath, ruleFile);
      return { status: 'success', scope, path: filePath, message: 'Skill rule installed' };
    } catch (e) {
      return { status: 'failed', scope, message: `Write failed: ${(e as Error).message}` };
    }
  },
};
