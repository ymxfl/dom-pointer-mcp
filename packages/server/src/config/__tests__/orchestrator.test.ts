import { executeForAgents } from '../orchestrator';
import type { ToolAdapter, OperationResult } from '../types';

jest.mock('../../logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), error: jest.fn() },
}));

function stub(
  toolId: any,
  displayName: string,
  results: Partial<Record<string, OperationResult>>,
): ToolAdapter {
  const ok: OperationResult = { status: 'success', message: 'ok' };
  return {
    toolId,
    displayName,
    registerMcp: jest.fn().mockResolvedValue(results.registerMcp ?? ok),
    installCommand: jest.fn().mockResolvedValue(results.installCommand ?? ok),
    installSkill: jest.fn().mockResolvedValue(results.installSkill ?? ok),
    unregisterMcp: jest.fn().mockResolvedValue(results.unregisterMcp ?? ok),
    uninstallCommand: jest.fn().mockResolvedValue(results.uninstallCommand ?? ok),
    uninstallSkill: jest.fn().mockResolvedValue(results.uninstallSkill ?? ok),
  };
}

describe('executeForAgents — install', () => {
  it('calls registerMcp + installSkill + installCommand when withSlash=true', async () => {
    const a = stub('claude', 'Claude', {});
    const summary = await executeForAgents([a], {
      mode: 'install', scope: 'user', port: 7007, withSlash: true,
    });
    expect(a.registerMcp).toHaveBeenCalledWith('user', 7007, undefined);
    expect(a.installSkill).toHaveBeenCalledWith('user');
    expect(a.installCommand).toHaveBeenCalledWith('user');
    expect(summary.exitCode).toBe(0);
  });

  it('skips installCommand when withSlash=false', async () => {
    const a = stub('claude', 'Claude', {});
    await executeForAgents([a], {
      mode: 'install', scope: 'user', port: 7007, withSlash: false,
    });
    expect(a.installCommand).not.toHaveBeenCalled();
  });

  it('exitCode=1 when any result is failed', async () => {
    const a = stub('claude', 'Claude', {
      registerMcp: { status: 'failed', message: 'boom' },
    });
    const summary = await executeForAgents([a], {
      mode: 'install', scope: 'user', port: 7007, withSlash: true,
    });
    expect(summary.exitCode).toBe(1);
  });

  it('exitCode=0 when results are degraded or skipped', async () => {
    const a = stub('claude', 'Claude', {
      registerMcp: { status: 'degraded', message: 'ok-ish' },
      installSkill: { status: 'skipped', message: 'n/a' },
    });
    const summary = await executeForAgents([a], {
      mode: 'install', scope: 'user', port: 7007, withSlash: true,
    });
    expect(summary.exitCode).toBe(0);
  });
});

describe('executeForAgents — uninstall', () => {
  it('calls unregisterMcp + uninstallSkill + uninstallCommand', async () => {
    const a = stub('claude', 'Claude', {});
    await executeForAgents([a], { mode: 'uninstall', scope: 'user' });
    expect(a.unregisterMcp).toHaveBeenCalledWith('user');
    expect(a.uninstallSkill).toHaveBeenCalledWith('user');
    expect(a.uninstallCommand).toHaveBeenCalledWith('user');
  });
});
