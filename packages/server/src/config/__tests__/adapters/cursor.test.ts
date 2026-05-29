import path from 'path';
import os from 'os';

jest.mock('fs/promises', () => ({
  mkdir: jest.fn().mockResolvedValue(undefined),
  writeFile: jest.fn().mockResolvedValue(undefined),
  readFile: jest.fn().mockRejectedValue(Object.assign(new Error(), { code: 'ENOENT' })),
  unlink: jest.fn().mockResolvedValue(undefined),
  access: jest.fn().mockResolvedValue(undefined),
}));

import fs from 'fs/promises';
import { cursorAdapter } from '../../adapters/cursor';

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

describe('cursorAdapter', () => {
  describe('installCommand', () => {
    it('user scope writes ~/.cursor/commands/pointed.md', async () => {
      const result = await cursorAdapter.installCommand('user');
      expect(result.status).toBe('success');
      expect(result.path).toBe(path.join(os.homedir(), '.cursor', 'commands', 'pointed.md'));
    });

    it('project scope writes <cwd>/.cursor/commands/pointed.md', async () => {
      const result = await cursorAdapter.installCommand('project');
      expect(result.status).toBe('success');
      expect(result.path).toBe(path.join(process.cwd(), '.cursor', 'commands', 'pointed.md'));
    });
  });

  describe('installSkill', () => {
    it('user scope writes ~/.cursor/rules/pointed.mdc', async () => {
      const result = await cursorAdapter.installSkill!('user');
      expect(result.status).toBe('success');
      expect(result.path).toBe(path.join(os.homedir(), '.cursor', 'rules', 'pointed.mdc'));
      const writeCall = mockedWriteFile.mock.calls.find((c) => c[0].endsWith('pointed.mdc'));
      expect(writeCall).toBeDefined();
      expect(String(writeCall![1])).toContain('description:');
    });

    it('project scope writes <cwd>/.cursor/rules/pointed.mdc', async () => {
      const result = await cursorAdapter.installSkill!('project');
      expect(result.status).toBe('success');
      expect(result.path).toBe(path.join(process.cwd(), '.cursor', 'rules', 'pointed.mdc'));
    });
  });

  describe('registerMcp', () => {
    it('project scope writes .cursor/mcp.json with pointer entry', async () => {
      const result = await cursorAdapter.registerMcp('project', 7007);
      expect(result.status).toBe('success');
      expect(result.path).toBe(path.join(process.cwd(), '.cursor', 'mcp.json'));
      const written = JSON.parse(mockedWriteFile.mock.calls[0][1]);
      expect(written.mcpServers.pointer.env.MCP_POINTER_PORT).toBe('7007');
    });

    it('merges into existing mcp.json preserving other servers', async () => {
      mockedReadFile.mockResolvedValueOnce(JSON.stringify({
        mcpServers: {
          other: { command: 'node', args: ['other.js'] },
        },
      }));
      const result = await cursorAdapter.registerMcp('project', 7007);
      expect(result.status).toBe('success');
      const written = JSON.parse(mockedWriteFile.mock.calls[0][1]);
      expect(written.mcpServers.other.command).toBe('node');
      expect(written.mcpServers.pointer.env.MCP_POINTER_PORT).toBe('7007');
    });
  });
});

describe('cursorAdapter uninstall', () => {
  describe('uninstallCommand', () => {
    it('user scope deletes ~/.cursor/commands/pointed.md', async () => {
      const unlinkMock = fs.unlink as jest.Mock;
      unlinkMock.mockReset();
      unlinkMock.mockResolvedValue(undefined);
      const result = await cursorAdapter.uninstallCommand!('user');
      expect(result.status).toBe('success');
      const expected = path.join(os.homedir(), '.cursor', 'commands', 'pointed.md');
      expect(result.path).toBe(expected);
      expect(unlinkMock).toHaveBeenCalledWith(expected);
    });

    it('user scope returns skipped when file missing', async () => {
      const unlinkMock = fs.unlink as jest.Mock;
      unlinkMock.mockReset();
      unlinkMock.mockRejectedValue(Object.assign(new Error(), { code: 'ENOENT' }));
      const result = await cursorAdapter.uninstallCommand!('user');
      expect(result.status).toBe('skipped');
    });

    it('project scope deletes <cwd>/.cursor/commands/pointed.md', async () => {
      const unlinkMock = fs.unlink as jest.Mock;
      unlinkMock.mockReset();
      unlinkMock.mockResolvedValue(undefined);
      const result = await cursorAdapter.uninstallCommand!('project');
      expect(result.status).toBe('success');
      const expected = path.join(process.cwd(), '.cursor', 'commands', 'pointed.md');
      expect(result.path).toBe(expected);
      expect(unlinkMock).toHaveBeenCalledWith(expected);
    });
  });

  describe('uninstallSkill', () => {
    it('user scope deletes ~/.cursor/rules/pointed.mdc', async () => {
      const unlinkMock = fs.unlink as jest.Mock;
      unlinkMock.mockReset();
      unlinkMock.mockResolvedValue(undefined);
      const result = await cursorAdapter.uninstallSkill!('user');
      expect(result.status).toBe('success');
      const expected = path.join(os.homedir(), '.cursor', 'rules', 'pointed.mdc');
      expect(result.path).toBe(expected);
      expect(unlinkMock).toHaveBeenCalledWith(expected);
    });

    it('user scope returns skipped when file missing', async () => {
      const unlinkMock = fs.unlink as jest.Mock;
      unlinkMock.mockReset();
      unlinkMock.mockRejectedValue(Object.assign(new Error(), { code: 'ENOENT' }));
      const result = await cursorAdapter.uninstallSkill!('user');
      expect(result.status).toBe('skipped');
    });

    it('project scope deletes <cwd>/.cursor/rules/pointed.mdc', async () => {
      const unlinkMock = fs.unlink as jest.Mock;
      unlinkMock.mockReset();
      unlinkMock.mockResolvedValue(undefined);
      const result = await cursorAdapter.uninstallSkill!('project');
      expect(result.status).toBe('success');
      const expected = path.join(process.cwd(), '.cursor', 'rules', 'pointed.mdc');
      expect(result.path).toBe(expected);
      expect(unlinkMock).toHaveBeenCalledWith(expected);
    });
  });

  describe('unregisterMcp', () => {
    it('user scope removes mcpServers.pointer from ~/.cursor/mcp.json, preserves others', async () => {
      mockedReadFile.mockResolvedValueOnce(JSON.stringify({
        mcpServers: {
          other: { command: 'node' },
          pointer: { command: 'old' },
        },
        unrelated: 'keep me',
      }));
      const result = await cursorAdapter.unregisterMcp!('user');
      expect(result.status).toBe('success');
      const expected = path.join(os.homedir(), '.cursor', 'mcp.json');
      expect(result.path).toBe(expected);
      const writeCall = mockedWriteFile.mock.calls.find((c) => c[0] === expected);
      expect(writeCall).toBeDefined();
      const written = JSON.parse(writeCall![1]);
      expect(written.mcpServers.pointer).toBeUndefined();
      expect(written.mcpServers.other.command).toBe('node');
      expect(written.unrelated).toBe('keep me');
    });

    it('user scope returns skipped when mcp.json missing', async () => {
      (fs.access as jest.Mock).mockReset();
      (fs.access as jest.Mock).mockRejectedValue(Object.assign(new Error(), { code: 'ENOENT' }));
      const result = await cursorAdapter.unregisterMcp!('user');
      expect(result.status).toBe('skipped');
    });

    it('user scope returns skipped when pointer key absent', async () => {
      mockedReadFile.mockResolvedValueOnce(JSON.stringify({
        mcpServers: { other: { command: 'node' } },
      }));
      const result = await cursorAdapter.unregisterMcp!('user');
      expect(result.status).toBe('skipped');
    });

    it('user scope writes back mcpServers:{} when pointer was the only key', async () => {
      mockedReadFile.mockResolvedValueOnce(JSON.stringify({
        mcpServers: { pointer: { command: 'old' } },
      }));
      const result = await cursorAdapter.unregisterMcp!('user');
      expect(result.status).toBe('success');
      const writeCall = mockedWriteFile.mock.calls.find((c) => c[0].endsWith('mcp.json'));
      expect(writeCall).toBeDefined();
      const written = JSON.parse(writeCall![1]);
      expect(written.mcpServers).toEqual({});
    });

    it('project scope removes from <cwd>/.cursor/mcp.json', async () => {
      mockedReadFile.mockResolvedValueOnce(JSON.stringify({
        mcpServers: {
          other: { command: 'node' },
          pointer: { command: 'old' },
        },
      }));
      const result = await cursorAdapter.unregisterMcp!('project');
      expect(result.status).toBe('success');
      const expected = path.join(process.cwd(), '.cursor', 'mcp.json');
      expect(result.path).toBe(expected);
      const writeCall = mockedWriteFile.mock.calls.find((c) => c[0] === expected);
      expect(writeCall).toBeDefined();
      const written = JSON.parse(writeCall![1]);
      expect(written.mcpServers.pointer).toBeUndefined();
      expect(written.mcpServers.other.command).toBe('node');
    });
  });
});
