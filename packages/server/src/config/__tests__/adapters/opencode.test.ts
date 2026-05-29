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
import { opencodeAdapter } from '../../adapters/opencode';

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

describe('opencodeAdapter', () => {
  describe('installCommand', () => {
    it('user writes ~/.config/opencode/commands/pointed.md', async () => {
      const result = await opencodeAdapter.installCommand('user');
      expect(result.status).toBe('success');
      expect(result.path).toBe(path.join(os.homedir(), '.config', 'opencode', 'commands', 'pointed.md'));
    });

    it('project writes <cwd>/.opencode/commands/pointed.md', async () => {
      const result = await opencodeAdapter.installCommand('project');
      expect(result.status).toBe('success');
      expect(result.path).toBe(path.join(process.cwd(), '.opencode', 'commands', 'pointed.md'));
    });
  });

  it('has no installSkill (opencode commands ARE the slash mechanism)', () => {
    expect(opencodeAdapter.installSkill).toBeUndefined();
  });

  it('registerMcp merges with existing opencode.json mcp servers', async () => {
    mockedReadFile.mockResolvedValueOnce(JSON.stringify({
      mcp: { context7: { type: 'remote', url: 'x' } },
      otherTopLevel: { keep: true },
    }));
    const result = await opencodeAdapter.registerMcp('project', 7007);
    expect(result.status).toBe('success');
    expect(result.path).toBe(path.join(process.cwd(), 'opencode.json'));
    const written = JSON.parse(mockedWriteFile.mock.calls[0][1]);
    expect(written.mcp.context7).toBeDefined();
    expect(written.mcp.pointer).toBeDefined();
    expect(written.mcp.pointer.command).toBeDefined();
    expect(written.otherTopLevel.keep).toBe(true);
  });
});

describe('opencodeAdapter uninstall', () => {
  describe('uninstallCommand', () => {
    it('user scope deletes ~/.config/opencode/commands/pointed.md', async () => {
      const unlinkMock = fs.unlink as jest.Mock;
      unlinkMock.mockReset();
      unlinkMock.mockResolvedValue(undefined);
      const result = await opencodeAdapter.uninstallCommand('user');
      expect(result.status).toBe('success');
      const expected = path.join(os.homedir(), '.config', 'opencode', 'commands', 'pointed.md');
      expect(result.path).toBe(expected);
      expect(unlinkMock).toHaveBeenCalledWith(expected);
    });

    it('user scope returns skipped when command file is missing', async () => {
      const unlinkMock = fs.unlink as jest.Mock;
      unlinkMock.mockReset();
      unlinkMock.mockRejectedValue(Object.assign(new Error(), { code: 'ENOENT' }));
      const result = await opencodeAdapter.uninstallCommand('user');
      expect(result.status).toBe('skipped');
    });

    it('project scope deletes <cwd>/.opencode/commands/pointed.md', async () => {
      const unlinkMock = fs.unlink as jest.Mock;
      unlinkMock.mockReset();
      unlinkMock.mockResolvedValue(undefined);
      const result = await opencodeAdapter.uninstallCommand('project');
      expect(result.status).toBe('success');
      const expected = path.join(process.cwd(), '.opencode', 'commands', 'pointed.md');
      expect(result.path).toBe(expected);
      expect(unlinkMock).toHaveBeenCalledWith(expected);
    });
  });

  describe('unregisterMcp', () => {
    it('user scope removes mcp.pointer, preserves mcp.other and top-level non-mcp keys', async () => {
      mockedReadFile.mockResolvedValueOnce(JSON.stringify({
        mcp: {
          other: { type: 'remote', url: 'x' },
          pointer: { type: 'local', command: ['old'] },
        },
        otherTopLevel: { keep: true },
      }));
      const result = await opencodeAdapter.unregisterMcp('user');
      expect(result.status).toBe('success');
      expect(result.path).toBe(path.join(os.homedir(), '.config', 'opencode', 'opencode.json'));
      const writeCall = mockedWriteFile.mock.calls.find(
        (c) => c[0] === path.join(os.homedir(), '.config', 'opencode', 'opencode.json'),
      );
      expect(writeCall).toBeDefined();
      const written = JSON.parse(writeCall![1]);
      expect(written.mcp.pointer).toBeUndefined();
      expect(written.mcp.other).toBeDefined();
      expect(written.otherTopLevel.keep).toBe(true);
    });

    it('user scope returns skipped when opencode.json is missing', async () => {
      (fs.access as jest.Mock).mockReset();
      (fs.access as jest.Mock).mockRejectedValue(Object.assign(new Error(), { code: 'ENOENT' }));
      mockedReadFile.mockRejectedValueOnce(Object.assign(new Error(), { code: 'ENOENT' }));
      const result = await opencodeAdapter.unregisterMcp('user');
      expect(result.status).toBe('skipped');
    });

    it('user scope returns skipped when pointer key is absent', async () => {
      mockedReadFile.mockResolvedValueOnce(JSON.stringify({
        mcp: { other: { type: 'remote', url: 'x' } },
      }));
      const result = await opencodeAdapter.unregisterMcp('user');
      expect(result.status).toBe('skipped');
    });

    it('user scope leaves mcp:{} when pointer was the only key (does not unlink)', async () => {
      mockedReadFile.mockResolvedValueOnce(JSON.stringify({
        mcp: { pointer: { type: 'local', command: ['old'] } },
      }));
      const unlinkMock = fs.unlink as jest.Mock;
      unlinkMock.mockReset();
      unlinkMock.mockResolvedValue(undefined);
      const result = await opencodeAdapter.unregisterMcp('user');
      expect(result.status).toBe('success');
      const writeCall = mockedWriteFile.mock.calls.find(
        (c) => c[0] === path.join(os.homedir(), '.config', 'opencode', 'opencode.json'),
      );
      const written = JSON.parse(writeCall![1]);
      expect(written.mcp).toEqual({});
      expect(unlinkMock).not.toHaveBeenCalled();
    });

    it('project scope operates on <cwd>/opencode.json', async () => {
      mockedReadFile.mockResolvedValueOnce(JSON.stringify({
        mcp: { pointer: { type: 'local', command: ['old'] } },
      }));
      const result = await opencodeAdapter.unregisterMcp('project');
      expect(result.status).toBe('success');
      expect(result.path).toBe(path.join(process.cwd(), 'opencode.json'));
    });
  });
});
