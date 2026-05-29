import path from 'path';
import os from 'os';

import fs from 'fs/promises';
import { codexAdapter } from '../../adapters/codex';

jest.mock('fs/promises', () => ({
  mkdir: jest.fn().mockResolvedValue(undefined),
  writeFile: jest.fn().mockResolvedValue(undefined),
  readFile: jest.fn().mockRejectedValue(Object.assign(new Error(), { code: 'ENOENT' })),
  unlink: jest.fn().mockResolvedValue(undefined),
  access: jest.fn().mockResolvedValue(undefined),
}));

const mockedWriteFile = fs.writeFile as jest.Mock;
const mockedReadFile = fs.readFile as jest.Mock;

beforeEach(() => {
  mockedWriteFile.mockReset();
  mockedWriteFile.mockResolvedValue(undefined);
  mockedReadFile.mockReset();
  mockedReadFile.mockRejectedValue(Object.assign(new Error(), { code: 'ENOENT' }));
  (fs.unlink as jest.Mock).mockReset();
  (fs.unlink as jest.Mock).mockResolvedValue(undefined);
  (fs.access as jest.Mock).mockReset();
  (fs.access as jest.Mock).mockResolvedValue(undefined);
});

describe('codexAdapter', () => {
  describe('installCommand', () => {
    it('user writes ~/.codex/prompts/pointed.md', async () => {
      const result = await codexAdapter.installCommand('user');
      expect(result.status).toBe('success');
      expect(result.path).toBe(path.join(os.homedir(), '.codex', 'prompts', 'pointed.md'));
    });

    it('project degrades to user scope', async () => {
      const result = await codexAdapter.installCommand('project');
      expect(result.status).toBe('degraded');
      expect(result.scope).toBe('user');
      expect(result.message).toMatch(/only supports user-level/i);
    });
  });

  it('has no installSkill (codex prompts ARE the slash mechanism)', () => {
    expect(codexAdapter.installSkill).toBeUndefined();
  });

  describe('registerMcp', () => {
    it('user writes ~/.codex/config.toml with [mcp_servers.dom-pointer]', async () => {
      const result = await codexAdapter.registerMcp('user', 7007);
      expect(result.status).toBe('success');
      expect(result.path).toBe(path.join(os.homedir(), '.codex', 'config.toml'));
      const content = mockedWriteFile.mock.calls[0][1] as string;
      expect(content).toMatch(/\[mcp_servers\.dom-pointer\]/);
      expect(content).toContain('command = "npx"');
      expect(content).toContain('MCP_POINTER_PORT = "7007"');
    });

    it('project preserves existing TOML content', async () => {
      mockedReadFile.mockResolvedValueOnce(
        '[other]\nfoo = "bar"\n\n[mcp_servers.previously]\ncommand = "old"\n',
      );
      const result = await codexAdapter.registerMcp('project', 7007);
      expect(result.status).toBe('success');
      const content = mockedWriteFile.mock.calls[0][1] as string;
      expect(content).toContain('[other]');
      expect(content).toContain('foo = "bar"');
      expect(content).toContain('[mcp_servers.previously]');
      expect(content).toContain('[mcp_servers.dom-pointer]');
    });
  });
});

describe('codexAdapter uninstall', () => {
  describe('uninstallCommand', () => {
    it('user scope deletes ~/.codex/prompts/pointed.md', async () => {
      const unlinkMock = fs.unlink as jest.Mock;
      unlinkMock.mockReset();
      unlinkMock.mockResolvedValue(undefined);
      const result = await codexAdapter.uninstallCommand('user');
      expect(result.status).toBe('success');
      expect(result.scope).toBe('user');
      const expected = path.join(os.homedir(), '.codex', 'prompts', 'pointed.md');
      expect(result.path).toBe(expected);
      expect(unlinkMock).toHaveBeenCalledWith(expected);
    });

    it('user scope returns skipped when file missing', async () => {
      const unlinkMock = fs.unlink as jest.Mock;
      unlinkMock.mockReset();
      unlinkMock.mockRejectedValue(Object.assign(new Error(), { code: 'ENOENT' }));
      const result = await codexAdapter.uninstallCommand('user');
      expect(result.status).toBe('skipped');
    });

    it('project scope still operates on user file, status degraded', async () => {
      const unlinkMock = fs.unlink as jest.Mock;
      unlinkMock.mockReset();
      unlinkMock.mockResolvedValue(undefined);
      const result = await codexAdapter.uninstallCommand('project');
      expect(result.status).toBe('degraded');
      expect(result.scope).toBe('user');
      const expected = path.join(os.homedir(), '.codex', 'prompts', 'pointed.md');
      expect(result.path).toBe(expected);
      expect(unlinkMock).toHaveBeenCalledWith(expected);
    });

    it('project scope returns skipped when file missing', async () => {
      const unlinkMock = fs.unlink as jest.Mock;
      unlinkMock.mockReset();
      unlinkMock.mockRejectedValue(Object.assign(new Error(), { code: 'ENOENT' }));
      const result = await codexAdapter.uninstallCommand('project');
      expect(result.status).toBe('skipped');
    });
  });

  describe('unregisterMcp', () => {
    const fixture = [
      '# top-level',
      'key = "value"',
      '',
      '[mcp_servers.other]',
      'command = "other"',
      '',
      '[mcp_servers.dom-pointer]',
      'command = "npx"',
      'args = ["-y", "@dom-pointer-mcp/server@latest", "start"]',
      '',
      '[mcp_servers.dom-pointer.env]',
      'MCP_POINTER_PORT = "7007"',
      '',
      '[unrelated]',
      'foo = "bar"',
      '',
    ].join('\n');

    it('user scope strips [mcp_servers.dom-pointer] and sub-tables only', async () => {
      mockedReadFile.mockResolvedValueOnce(fixture);
      const result = await codexAdapter.unregisterMcp('user');
      expect(result.status).toBe('success');
      const expected = path.join(os.homedir(), '.codex', 'config.toml');
      expect(result.path).toBe(expected);
      const writeCall = mockedWriteFile.mock.calls.find((c) => c[0] === expected);
      expect(writeCall).toBeDefined();
      const written = writeCall![1] as string;
      expect(written).toContain('[mcp_servers.other]');
      expect(written).toContain('[unrelated]');
      expect(written).toContain('key = "value"');
      expect(written).not.toContain('[mcp_servers.dom-pointer]');
      expect(written).not.toContain('[mcp_servers.dom-pointer.env]');
      expect(written).not.toContain('MCP_POINTER_PORT');
    });

    it('user scope returns skipped when [mcp_servers.dom-pointer] not present', async () => {
      mockedReadFile.mockResolvedValueOnce('[other]\nfoo = "bar"\n');
      const result = await codexAdapter.unregisterMcp('user');
      expect(result.status).toBe('skipped');
      expect(mockedWriteFile).not.toHaveBeenCalled();
    });

    it('user scope returns skipped when file missing', async () => {
      (fs.access as jest.Mock).mockReset();
      (fs.access as jest.Mock).mockRejectedValue(Object.assign(new Error(), { code: 'ENOENT' }));
      const result = await codexAdapter.unregisterMcp('user');
      expect(result.status).toBe('skipped');
      expect(mockedWriteFile).not.toHaveBeenCalled();
    });

    it('project scope removes from <cwd>/.codex/config.toml', async () => {
      mockedReadFile.mockResolvedValueOnce(fixture);
      const result = await codexAdapter.unregisterMcp('project');
      expect(result.status).toBe('success');
      const expected = path.join(process.cwd(), '.codex', 'config.toml');
      expect(result.path).toBe(expected);
      const writeCall = mockedWriteFile.mock.calls.find((c) => c[0] === expected);
      expect(writeCall).toBeDefined();
      const written = writeCall![1] as string;
      expect(written).not.toContain('[mcp_servers.dom-pointer]');
      expect(written).not.toContain('MCP_POINTER_PORT');
      expect(written).toContain('[mcp_servers.other]');
    });

    it('project scope returns skipped when file missing', async () => {
      (fs.access as jest.Mock).mockReset();
      (fs.access as jest.Mock).mockRejectedValue(Object.assign(new Error(), { code: 'ENOENT' }));
      const result = await codexAdapter.unregisterMcp('project');
      expect(result.status).toBe('skipped');
      expect(mockedWriteFile).not.toHaveBeenCalled();
    });
  });
});
