import logger from './logger';
import { getAdapter, listAdapters } from './config/adapters/index';
import { resolveScope } from './config/scope';
import type { OperationResult, Scope } from './config/types';

// ============================================================
// Public runtime exports (used by start.ts and friends)
// ============================================================

export interface MCPConfig {
  websocket: {
    port: number;
  };
}

export const config: MCPConfig = {
  websocket: {
    port: 7007,
  },
};

// ============================================================
// CLI config command (used by cli.ts)
// ============================================================

export enum SupportedTool {
  CLAUDE = 'claude',
  CURSOR = 'cursor',
  WINDSURF = 'windsurf',
  CODEX = 'codex',
  OPENCODE = 'opencode',
  JOYCODE = 'joycode',
}

function getPort(): string {
  return process.env.MCP_POINTER_PORT || '7007';
}

function showAvailableTools(): void {
  logger.info('📋 MCP Pointer Configuration');
  logger.info('');
  logger.info('Usage: mcp-pointer config <tool> [--scope user|project]');
  logger.info('');
  logger.info('Supported tools:');
  logger.info('  claude    - Claude Code (skill + MCP)');
  logger.info('  cursor    - Cursor IDE (rules + MCP)');
  logger.info('  windsurf  - Windsurf IDE (global_rules + MCP; user-only MCP)');
  logger.info('  codex     - OpenAI Codex CLI (TOML + prompt; user-only prompt)');
  logger.info('  opencode  - OpenCode (command + MCP)');
  logger.info('  joycode   - JoyCode (prompt.json + MCP; project-only prompt)');
  logger.info('');
  logger.info('Scope:');
  logger.info('  user      - install globally for all projects');
  logger.info('  project   - install in current directory');
  logger.info('');
  logger.info('💡 If --scope is omitted, an interactive prompt asks you to choose.');
  logger.info('💡 Set MCP_POINTER_PORT env var to override default port 7007.');
}

function printResult(label: string, r: OperationResult): void {
  let icon: string;
  if (r.status === 'success') icon = '✅';
  else if (r.status === 'degraded') icon = '⚠️';
  else if (r.status === 'skipped') icon = '⏭️';
  else icon = '❌';
  const where = r.path ? ` (${r.path})` : '';
  logger.info(`  ${icon} ${label}: ${r.message}${where}`);
}

export default async function configCommand(
  tool?: string,
  opts: { scope?: string } = {},
): Promise<void> {
  if (!tool) {
    showAvailableTools();
    return;
  }
  const adapter = getAdapter(tool);
  if (!adapter) {
    logger.error(`❌ Unsupported tool: ${tool}`);
    logger.error(`Supported tools: ${listAdapters().map((a) => a.toolId).join(', ')}`);
    process.exit(1);
  }
  let scope: Scope;
  try {
    scope = await resolveScope(opts.scope);
  } catch (e) {
    logger.error(`❌ ${(e as Error).message}`);
    process.exit(1);
  }
  const port = parseInt(getPort(), 10);
  logger.info(`🔧 Configuring MCP Pointer for ${adapter.displayName} (${scope} scope)...`);

  const mcpResult = await adapter.registerMcp(scope, port);
  printResult('MCP server', mcpResult);
  const commandResult = await adapter.installCommand(scope);
  printResult('Slash command', commandResult);

  let skillResult: OperationResult | null = null;
  if (adapter.installSkill) {
    skillResult = await adapter.installSkill(scope);
    printResult('Skill', skillResult);
  }

  const failed = mcpResult.status === 'failed'
    || commandResult.status === 'failed'
    || (skillResult !== null && skillResult.status === 'failed');
  if (failed) {
    process.exit(1);
  }
}
