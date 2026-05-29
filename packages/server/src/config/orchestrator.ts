import logger from '../logger';
import { listAdapters } from './adapters/index';
import {
  selectAgents, selectScope, confirmSlash, confirmUninstall,
} from './prompts';
import type { OperationResult, Scope, ToolAdapter } from './types';

export interface RunOptions {
  mode: 'install' | 'uninstall';
  scope: Scope;
  port?: number; // install only
  withSlash?: boolean; // install only
}

export interface RunSummary {
  exitCode: 0 | 1;
}

function iconFor(status: OperationResult['status']): string {
  if (status === 'success') return '✅';
  if (status === 'degraded') return '⚠️';
  if (status === 'skipped') return '⏭';
  return '❌';
}

function printResult(adapter: ToolAdapter, label: string, r: OperationResult): void {
  const where = r.path ? ` (${r.path})` : '';
  logger.info(`  ${iconFor(r.status)} ${adapter.displayName} · ${label}: ${r.message}${where}`);
}

export async function executeForAgents(
  adapters: ToolAdapter[],
  opts: RunOptions,
): Promise<RunSummary> {
  const results: OperationResult[] = [];

  await adapters.reduce(async (previous, adapter) => {
    await previous;

    if (opts.mode === 'install') {
      const mcp = await adapter.registerMcp(opts.scope, opts.port ?? 7007);
      printResult(adapter, 'MCP server', mcp);
      results.push(mcp);

      if (adapter.installSkill) {
        const sk = await adapter.installSkill(opts.scope);
        printResult(adapter, 'Skill', sk);
        results.push(sk);
      }

      if (opts.withSlash) {
        const cmd = await adapter.installCommand(opts.scope);
        printResult(adapter, 'Slash command', cmd);
        results.push(cmd);
      }
    } else {
      const mcp = await adapter.unregisterMcp(opts.scope);
      printResult(adapter, 'MCP server', mcp);
      results.push(mcp);

      if (adapter.uninstallSkill) {
        const sk = await adapter.uninstallSkill(opts.scope);
        printResult(adapter, 'Skill', sk);
        results.push(sk);
      }

      const cmd = await adapter.uninstallCommand(opts.scope);
      printResult(adapter, 'Slash command', cmd);
      results.push(cmd);
    }
  }, Promise.resolve());

  const exitCode: 0 | 1 = results.some((r) => r.status === 'failed') ? 1 : 0;
  return { exitCode };
}

export async function runInteractiveInstall(port: number): Promise<RunSummary> {
  const adapters = await selectAgents(listAdapters(), 'Select agents (space to toggle, enter to confirm):');
  const scope = await selectScope();
  const withSlash = await confirmSlash();
  logger.info('');
  logger.info(`🔧 Installing for ${adapters.map((a) => a.displayName).join(', ')} (${scope} scope)...`);
  return executeForAgents(adapters, {
    mode: 'install', scope, port, withSlash,
  });
}

export async function runInteractiveUninstall(): Promise<RunSummary> {
  const adapters = await selectAgents(listAdapters(), 'Select agents to uninstall (user scope):');
  const ok = await confirmUninstall(adapters.map((a) => a.displayName));
  if (!ok) {
    logger.info('Cancelled.');
    return { exitCode: 0 };
  }
  logger.info('');
  logger.info(`🗑  Uninstalling from ${adapters.map((a) => a.displayName).join(', ')} (user scope)...`);
  const summary = await executeForAgents(adapters, { mode: 'uninstall', scope: 'user' });
  logger.info('');
  logger.info('💡 To remove project-scope installs, cd into the project and run:');
  logger.info('   dom-pointer-mcp config --uninstall <tool> --scope project');
  return summary;
}

export async function runNonInteractiveUninstall(
  toolId: string,
  scope: Scope,
): Promise<RunSummary> {
  const adapter = listAdapters().find((a) => a.toolId === toolId);
  if (!adapter) {
    logger.error(`❌ Unsupported tool: ${toolId}`);
    return { exitCode: 1 };
  }
  logger.info(`🗑  Uninstalling DOM Pointer MCP from ${adapter.displayName} (${scope} scope)...`);
  return executeForAgents([adapter], { mode: 'uninstall', scope });
}
