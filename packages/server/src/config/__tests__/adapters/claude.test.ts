import path from 'path';
import os from 'os';

jest.mock('fs/promises', () => ({
  mkdir: jest.fn().mockResolvedValue(undefined),
  writeFile: jest.fn().mockResolvedValue(undefined),
  readFile: jest.fn().mockRejectedValue(Object.assign(new Error(), { code: 'ENOENT' })),
  unlink: jest.fn().mockResolvedValue(undefined),
  access: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('child_process', () => ({
  execSync: jest.fn(),
}));

import fs from 'fs/promises';
import { execSync } from 'child_process';
import { claudeAdapter } from '../../adapters/claude';

const mockedWriteFile = fs.writeFile as jest.Mock;
const mockedReadFile = fs.readFile as jest.Mock;
const mockedExecSync = execSync as jest.Mock;

beforeEach(() => {
  mockedWriteFile.mockReset();
  mockedWriteFile.mockResolvedValue(undefined);
  mockedReadFile.mockReset();
  mockedReadFile.mockRejectedValue(Object.assign(new Error(), { code: 'ENOENT' }));
  mockedExecSync.mockReset();
  mockedExecSync.mockReturnValue('');
  (fs.unlink as jest.Mock).mockReset();
  (fs.unlink as jest.Mock).mockResolvedValue(undefined);
  (fs.access as jest.Mock).mockReset();
  (fs.access as jest.Mock).mockResolvedValue(undefined);
});

describe('claudeAdapter', () => {
  describe('installCommand', () => {
    it('user scope writes ~/.claude/commands/pointed.md', async () => {
      const result = await claudeAdapter.installCommand('user');
      expect(result.status).toBe('success');
      const expectedPath = path.join(os.homedir(), '.claude', 'commands', 'pointed.md');
      expect(result.path).toBe(expectedPath);
      const writeCall = mockedWriteFile.mock.calls.find((call) => call[0] === expectedPath);
      expect(writeCall).toBeDefined();
      expect(String(writeCall![1])).toContain('description:');
    });

    it('project scope writes <cwd>/.claude/commands/pointed.md', async () => {
      const result = await claudeAdapter.installCommand('project');
      expect(result.status).toBe('success');
      expect(result.path).toBe(path.join(process.cwd(), '.claude', 'commands', 'pointed.md'));
    });
  });

  describe('installSkill', () => {
    it('user scope writes ~/.claude/skills/pointed/SKILL.md', async () => {
      const result = await claudeAdapter.installSkill!('user');
      expect(result.status).toBe('success');
      const expectedPath = path.join(os.homedir(), '.claude', 'skills', 'pointed', 'SKILL.md');
      expect(result.path).toBe(expectedPath);
      expect(mockedWriteFile).toHaveBeenCalledWith(expectedPath, expect.stringContaining('name: pointed'), 'utf8');
    });

    it('project scope writes <cwd>/.claude/skills/pointed/SKILL.md', async () => {
      const result = await claudeAdapter.installSkill!('project');
      expect(result.status).toBe('success');
      expect(result.path).toBe(path.join(process.cwd(), '.claude', 'skills', 'pointed', 'SKILL.md'));
    });
  });

  describe('registerMcp', () => {
    it('project scope writes .mcp.json with pointer entry', async () => {
      const result = await claudeAdapter.registerMcp('project', 7007);
      expect(result.status).toBe('success');
      expect(result.path).toBe(path.join(process.cwd(), '.mcp.json'));
      const writeCall = mockedWriteFile.mock.calls.find(
        (call) => call[0].endsWith('.mcp.json'),
      );
      expect(writeCall).toBeDefined();
      const written = JSON.parse(writeCall![1]);
      expect(written.mcpServers.pointer.command).toBe('npx');
      expect(written.mcpServers.pointer.env.MCP_POINTER_PORT).toBe('7007');
    });

    it('project scope merges into existing .mcp.json preserving other servers', async () => {
      mockedReadFile.mockResolvedValueOnce(JSON.stringify({
        mcpServers: {
          other: { command: 'node', args: ['other.js'] },
          pointer: { command: 'old', args: ['old'] },
        },
        unrelated: 'keep me',
      }));
      const result = await claudeAdapter.registerMcp('project', 7007);
      expect(result.status).toBe('success');
      const writeCall = mockedWriteFile.mock.calls.find(
        (call) => call[0].endsWith('.mcp.json'),
      );
      const written = JSON.parse(writeCall![1]);
      expect(written.mcpServers.other.command).toBe('node');
      expect(written.mcpServers.pointer.command).toBe('npx');
      expect(written.mcpServers.pointer.env.MCP_POINTER_PORT).toBe('7007');
      expect(written.unrelated).toBe('keep me');
    });

    it('user scope runs claude mcp add CLI', async () => {
      const result = await claudeAdapter.registerMcp('user', 7007);
      expect(result.status).toBe('success');
      const addCall = mockedExecSync.mock.calls.find(
        (call) => String(call[0]).includes('claude mcp add'),
      );
      expect(addCall).toBeDefined();
      expect(String(addCall![0])).toContain('MCP_POINTER_PORT=7007');
    });
  });
});

describe('claudeAdapter uninstall', () => {
  describe('uninstallCommand', () => {
    it('returns skipped when command file is missing', async () => {
      mockedReadFile.mockRejectedValue(Object.assign(new Error(), { code: 'ENOENT' }));
      (fs.unlink as jest.Mock).mockReset();
      (fs.unlink as jest.Mock).mockRejectedValue(Object.assign(new Error(), { code: 'ENOENT' }));
      const result = await claudeAdapter.uninstallCommand('user');
      expect(result.status).toBe('skipped');
    });

    it('deletes ~/.claude/commands/pointed.md when present', async () => {
      const unlinkMock = fs.unlink as jest.Mock;
      unlinkMock.mockReset();
      unlinkMock.mockResolvedValue(undefined);
      const result = await claudeAdapter.uninstallCommand('user');
      expect(result.status).toBe('success');
      const expected = path.join(os.homedir(), '.claude', 'commands', 'pointed.md');
      expect(unlinkMock).toHaveBeenCalledWith(expected);
    });
  });

  describe('uninstallSkill', () => {
    it('deletes ~/.claude/skills/pointed/SKILL.md when present', async () => {
      const unlinkMock = fs.unlink as jest.Mock;
      unlinkMock.mockReset();
      unlinkMock.mockResolvedValue(undefined);
      const result = await claudeAdapter.uninstallSkill!('user');
      expect(result.status).toBe('success');
      const expected = path.join(os.homedir(), '.claude', 'skills', 'pointed', 'SKILL.md');
      expect(unlinkMock).toHaveBeenCalledWith(expected);
    });
  });

  describe('unregisterMcp', () => {
    it('user scope runs `claude mcp remove`', async () => {
      mockedExecSync.mockReturnValueOnce('');
      const result = await claudeAdapter.unregisterMcp('user');
      expect(result.status).toBe('success');
      const removeCall = mockedExecSync.mock.calls.find(
        (c) => String(c[0]).includes('claude mcp remove'),
      );
      expect(removeCall).toBeDefined();
      expect(String(removeCall![0])).toContain('-s user');
    });

    it('user scope returns skipped when CLI says "not installed"', async () => {
      mockedExecSync.mockImplementation(() => {
        throw Object.assign(new Error('No MCP server with name'), { stderr: Buffer.from('not found') });
      });
      const result = await claudeAdapter.unregisterMcp('user');
      expect(result.status).toBe('skipped');
    });

    it('project scope removes pointer key from .mcp.json, preserves others', async () => {
      mockedReadFile.mockResolvedValueOnce(JSON.stringify({
        mcpServers: {
          other: { command: 'node' },
          pointer: { command: 'old' },
        },
        unrelated: 'keep me',
      }));
      const result = await claudeAdapter.unregisterMcp('project');
      expect(result.status).toBe('success');
      const writeCall = mockedWriteFile.mock.calls.find((c) => c[0].endsWith('.mcp.json'));
      expect(writeCall).toBeDefined();
      const written = JSON.parse(writeCall![1]);
      expect(written.mcpServers.pointer).toBeUndefined();
      expect(written.mcpServers.other.command).toBe('node');
      expect(written.unrelated).toBe('keep me');
    });

    it('project scope returns skipped when .mcp.json is missing', async () => {
      const fsMod = await import('fs/promises');
      (fsMod.access as unknown as jest.Mock).mockRejectedValueOnce(
        Object.assign(new Error(), { code: 'ENOENT' }),
      );
      mockedReadFile.mockRejectedValueOnce(Object.assign(new Error(), { code: 'ENOENT' }));
      const result = await claudeAdapter.unregisterMcp('project');
      expect(result.status).toBe('skipped');
    });

    it('project scope returns skipped when pointer key is absent', async () => {
      mockedReadFile.mockResolvedValueOnce(JSON.stringify({
        mcpServers: { other: { command: 'node' } },
      }));
      const result = await claudeAdapter.unregisterMcp('project');
      expect(result.status).toBe('skipped');
    });

    it('project scope leaves {} when last key is removed (does not unlink)', async () => {
      mockedReadFile.mockResolvedValueOnce(JSON.stringify({
        mcpServers: { pointer: { command: 'old' } },
      }));
      const result = await claudeAdapter.unregisterMcp('project');
      expect(result.status).toBe('success');
      const writeCall = mockedWriteFile.mock.calls.find((c) => c[0].endsWith('.mcp.json'));
      const written = JSON.parse(writeCall![1]);
      expect(written.mcpServers).toEqual({});
    });
  });
});
