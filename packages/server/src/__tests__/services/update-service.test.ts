import {
  detectLaunchHint,
  runServerUpdate,
  UpdateServiceDeps,
} from '../../services/update-service';

function createDeps(overrides: Partial<UpdateServiceDeps> = {}): UpdateServiceDeps {
  return {
    getCurrentVersion: () => '1.6.1',
    fetchLatestVersion: async () => '1.6.1',
    detectLaunchHint: () => 'global',
    runGlobalInstall: async () => undefined,
    ...overrides,
  };
}

describe('detectLaunchHint', () => {
  it('detects npx from argv', () => {
    expect(detectLaunchHint(['node', '/tmp/_npx/123/node_modules/@dom-pointer-mcp/server/dist/cli.cjs', 'start']))
      .toBe('npx');
  });

  it('detects global binary name', () => {
    expect(detectLaunchHint(['dom-pointer-mcp', 'start'])).toBe('global');
  });
});

describe('runServerUpdate', () => {
  it('reports up to date on check', async () => {
    const result = await runServerUpdate('check', createDeps());
    expect(result.updateAvailable).toBe(false);
    expect(result.latestVersion).toBe('1.6.1');
    expect(result.message).toContain('up to date');
  });

  it('reports available update on check', async () => {
    const result = await runServerUpdate('check', createDeps({
      fetchLatestVersion: async () => '1.7.0',
    }));
    expect(result.updateAvailable).toBe(true);
    expect(result.latestVersion).toBe('1.7.0');
    expect(result.applied).toBe(false);
  });

  it('returns error message when registry fails', async () => {
    const result = await runServerUpdate('check', createDeps({
      fetchLatestVersion: async () => {
        throw new Error('offline');
      },
    }));
    expect(result.latestVersion).toBeNull();
    expect(result.message).toContain('offline');
  });

  it('apply skips install for npx launches', async () => {
    const runGlobalInstall = jest.fn(async () => undefined);
    const result = await runServerUpdate('apply', createDeps({
      fetchLatestVersion: async () => '1.7.0',
      detectLaunchHint: () => 'npx',
      runGlobalInstall,
    }));
    expect(runGlobalInstall).not.toHaveBeenCalled();
    expect(result.applied).toBe(false);
    expect(result.message).toContain('Restart');
  });

  it('apply runs global install when update available', async () => {
    const runGlobalInstall = jest.fn(async () => undefined);
    const result = await runServerUpdate('apply', createDeps({
      fetchLatestVersion: async () => '1.7.0',
      detectLaunchHint: () => 'global',
      runGlobalInstall,
    }));
    expect(runGlobalInstall).toHaveBeenCalled();
    expect(result.applied).toBe(true);
  });
});
