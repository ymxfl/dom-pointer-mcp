import path from 'path';
import os from 'os';

jest.mock('fs/promises', () => ({
  mkdir: jest.fn().mockResolvedValue(undefined),
  writeFile: jest.fn().mockResolvedValue(undefined),
  readFile: jest.fn().mockRejectedValue(Object.assign(new Error(), { code: 'ENOENT' })),
}));

import fs from 'fs/promises';
import { codexAdapter } from '../../adapters/codex';

const mockedWriteFile = fs.writeFile as jest.Mock;
const mockedReadFile = fs.readFile as jest.Mock;

beforeEach(() => {
  mockedWriteFile.mockClear();
  mockedReadFile.mockClear();
  mockedReadFile.mockRejectedValue(Object.assign(new Error(), { code: 'ENOENT' }));
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
    it('user writes ~/.codex/config.toml with [mcp_servers.pointer]', async () => {
      const result = await codexAdapter.registerMcp('user', 7007);
      expect(result.status).toBe('success');
      expect(result.path).toBe(path.join(os.homedir(), '.codex', 'config.toml'));
      const content = mockedWriteFile.mock.calls[0][1] as string;
      expect(content).toMatch(/\[mcp_servers\.pointer\]/);
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
      expect(content).toContain('[mcp_servers.pointer]');
    });
  });
});
