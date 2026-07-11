import {
  checkExtensionUpdate,
  CHROME_WEB_STORE_URL,
  UpdateCheckDeps,
} from '../../services/update-check-service';

function createDeps(overrides: Partial<UpdateCheckDeps> = {}): UpdateCheckDeps {
  return {
    getCurrentVersion: () => '1.6.1',
    getInstallType: async () => 'unknown',
    requestChromeUpdateCheck: async () => 'unsupported',
    fetchGithubLatest: async () => ({
      version: '1.6.1',
      releaseUrl: 'https://github.com/ymxfl/dom-pointer-mcp/releases/tag/1.6.1',
      zipUrl: 'https://github.com/ymxfl/dom-pointer-mcp/releases/download/1.6.1/dom-pointer-mcp-chrome-extension.zip',
    }),
    ...overrides,
  };
}

describe('checkExtensionUpdate', () => {
  it('reports GitHub update when latest is newer', async () => {
    const result = await checkExtensionUpdate('github', createDeps({
      fetchGithubLatest: async () => ({
        version: '1.7.0',
        releaseUrl: 'https://github.com/ymxfl/dom-pointer-mcp/releases/tag/1.7.0',
        zipUrl: 'https://example.com/ext.zip',
      }),
    }));

    expect(result).toMatchObject({
      status: 'update-available',
      channel: 'github',
      currentVersion: '1.6.1',
      latestVersion: '1.7.0',
      updateUrl: 'https://example.com/ext.zip',
      messageKey: 'popup.updateAvailable',
    });
  });

  it('reports up-to-date on GitHub when versions match', async () => {
    const result = await checkExtensionUpdate('github', createDeps());
    expect(result.status).toBe('up-to-date');
    expect(result.channel).toBe('github');
    expect(result.messageKey).toBe('popup.updateUpToDate');
  });

  it('reports error when GitHub fetch fails', async () => {
    const result = await checkExtensionUpdate('github', createDeps({
      fetchGithubLatest: async () => {
        throw new Error('network down');
      },
    }));
    expect(result.status).toBe('error');
    expect(result.detail).toContain('network down');
  });

  it('uses Chrome Web Store when update_available', async () => {
    const result = await checkExtensionUpdate('chrome-web-store', createDeps({
      requestChromeUpdateCheck: async () => 'update_available',
    }));
    expect(result).toMatchObject({
      status: 'update-available',
      channel: 'chrome-web-store',
      updateUrl: CHROME_WEB_STORE_URL,
      messageKey: 'popup.updateCwsAvailable',
    });
  });

  it('auto prefers GitHub for development installs', async () => {
    const requestChromeUpdateCheck = jest.fn(async () => 'no_update' as const);
    const result = await checkExtensionUpdate('auto', createDeps({
      getInstallType: async () => 'development',
      requestChromeUpdateCheck,
      fetchGithubLatest: async () => ({
        version: '1.8.0',
        releaseUrl: 'https://github.com/ymxfl/dom-pointer-mcp/releases/tag/1.8.0',
      }),
    }));
    expect(requestChromeUpdateCheck).not.toHaveBeenCalled();
    expect(result.channel).toBe('github');
    expect(result.latestVersion).toBe('1.8.0');
  });

  it('auto falls back to GitHub when CWS is unsupported', async () => {
    const result = await checkExtensionUpdate('auto', createDeps({
      getInstallType: async () => 'normal',
      requestChromeUpdateCheck: async () => 'unsupported',
      fetchGithubLatest: async () => ({
        version: '1.9.0',
        releaseUrl: 'https://github.com/ymxfl/dom-pointer-mcp/releases/tag/1.9.0',
      }),
    }));
    expect(result.status).toBe('update-available');
    expect(result.channel).toBe('github');
  });

  it('auto returns CWS result when update is available there', async () => {
    const result = await checkExtensionUpdate('auto', createDeps({
      getInstallType: async () => 'normal',
      requestChromeUpdateCheck: async () => 'update_available',
    }));
    expect(result.channel).toBe('chrome-web-store');
    expect(result.status).toBe('update-available');
  });
});
