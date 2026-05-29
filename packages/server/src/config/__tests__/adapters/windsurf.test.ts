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
import { windsurfAdapter } from '../../adapters/windsurf';

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

describe('windsurfAdapter', () => {
  describe('installCommand', () => {
    it('user scope writes ~/.codeium/windsurf/workflows/pointed.md', async () => {
      const result = await windsurfAdapter.installCommand('user');
      expect(result.status).toBe('success');
      expect(result.path).toBe(
        path.join(os.homedir(), '.codeium', 'windsurf', 'workflows', 'pointed.md'),
      );
    });

    it('project scope writes <cwd>/.windsurf/workflows/pointed.md', async () => {
      const result = await windsurfAdapter.installCommand('project');
      expect(result.status).toBe('success');
      expect(result.path).toBe(
        path.join(process.cwd(), '.windsurf', 'workflows', 'pointed.md'),
      );
    });
  });

  describe('installSkill', () => {
    it('user appends to ~/.codeium/windsurf/global_rules.md', async () => {
      const result = await windsurfAdapter.installSkill!('user');
      expect(result.status).toBe('success');
      expect(result.path).toBe(
        path.join(os.homedir(), '.codeium', 'windsurf', 'global_rules.md'),
      );
    });

    it('project writes <cwd>/.windsurf/rules/pointed.md', async () => {
      const result = await windsurfAdapter.installSkill!('project');
      expect(result.status).toBe('success');
      expect(result.path).toBe(
        path.join(process.cwd(), '.windsurf', 'rules', 'pointed.md'),
      );
    });
  });

  describe('registerMcp', () => {
    it('user writes ~/.codeium/windsurf/mcp_config.json', async () => {
      const result = await windsurfAdapter.registerMcp('user', 7007);
      expect(result.status).toBe('success');
      expect(result.path).toBe(
        path.join(os.homedir(), '.codeium', 'windsurf', 'mcp_config.json'),
      );
    });

    it('project degrades to user scope with warning', async () => {
      const result = await windsurfAdapter.registerMcp('project', 7007);
      expect(result.status).toBe('degraded');
      expect(result.scope).toBe('user');
      expect(result.message).toMatch(/does not support project-level/i);
    });
  });
});

describe('windsurfAdapter uninstall', () => {
  describe('uninstallCommand', () => {
    it('user scope deletes ~/.codeium/windsurf/workflows/pointed.md', async () => {
      const unlinkMock = fs.unlink as jest.Mock;
      unlinkMock.mockReset();
      unlinkMock.mockResolvedValue(undefined);
      const result = await windsurfAdapter.uninstallCommand!('user');
      expect(result.status).toBe('success');
      const expected = path.join(os.homedir(), '.codeium', 'windsurf', 'workflows', 'pointed.md');
      expect(result.path).toBe(expected);
      expect(unlinkMock).toHaveBeenCalledWith(expected);
    });

    it('user scope returns skipped when file missing', async () => {
      const unlinkMock = fs.unlink as jest.Mock;
      unlinkMock.mockReset();
      unlinkMock.mockRejectedValue(Object.assign(new Error(), { code: 'ENOENT' }));
      const result = await windsurfAdapter.uninstallCommand!('user');
      expect(result.status).toBe('skipped');
    });

    it('project scope deletes <cwd>/.windsurf/workflows/pointed.md', async () => {
      const unlinkMock = fs.unlink as jest.Mock;
      unlinkMock.mockReset();
      unlinkMock.mockResolvedValue(undefined);
      const result = await windsurfAdapter.uninstallCommand!('project');
      expect(result.status).toBe('success');
      const expected = path.join(process.cwd(), '.windsurf', 'workflows', 'pointed.md');
      expect(result.path).toBe(expected);
      expect(unlinkMock).toHaveBeenCalledWith(expected);
    });
  });

  describe('uninstallSkill', () => {
    it('user scope returns skipped when global_rules.md missing', async () => {
      (fs.access as jest.Mock).mockReset();
      (fs.access as jest.Mock).mockRejectedValue(Object.assign(new Error(), { code: 'ENOENT' }));
      const result = await windsurfAdapter.uninstallSkill!('user');
      expect(result.status).toBe('skipped');
      expect(mockedWriteFile).not.toHaveBeenCalled();
    });

    it('user scope returns skipped when file exists but markers absent', async () => {
      mockedReadFile.mockResolvedValueOnce('some unrelated rules content\n');
      const result = await windsurfAdapter.uninstallSkill!('user');
      expect(result.status).toBe('skipped');
      expect(mockedWriteFile).not.toHaveBeenCalled();
    });

    it('user scope strips BEGIN..END block, preserving surrounding text', async () => {
      const fixture = [
        'before text',
        '',
        '<!-- BEGIN mcp-pointer skill -->',
        'some skill body',
        '<!-- END mcp-pointer skill -->',
        '',
        'after text',
        '',
      ].join('\n');
      mockedReadFile.mockResolvedValueOnce(fixture);
      const result = await windsurfAdapter.uninstallSkill!('user');
      expect(result.status).toBe('success');
      const expected = path.join(os.homedir(), '.codeium', 'windsurf', 'global_rules.md');
      expect(result.path).toBe(expected);
      const writeCall = mockedWriteFile.mock.calls.find((c) => c[0] === expected);
      expect(writeCall).toBeDefined();
      const written = writeCall![1] as string;
      expect(written).toContain('before text');
      expect(written).toContain('after text');
      expect(written).not.toContain('BEGIN');
      expect(written).not.toContain('END');
      expect(written).not.toContain('some skill body');
    });

    it('project scope deletes <cwd>/.windsurf/rules/pointed.md', async () => {
      const unlinkMock = fs.unlink as jest.Mock;
      unlinkMock.mockReset();
      unlinkMock.mockResolvedValue(undefined);
      const result = await windsurfAdapter.uninstallSkill!('project');
      expect(result.status).toBe('success');
      const expected = path.join(process.cwd(), '.windsurf', 'rules', 'pointed.md');
      expect(result.path).toBe(expected);
      expect(unlinkMock).toHaveBeenCalledWith(expected);
    });
  });

  describe('unregisterMcp', () => {
    it('user scope removes mcpServers.pointer, preserves siblings and top-level keys', async () => {
      mockedReadFile.mockResolvedValueOnce(JSON.stringify({
        mcpServers: {
          other: { command: 'node' },
          pointer: { command: 'old' },
        },
        unrelated: 'keep me',
      }));
      const result = await windsurfAdapter.unregisterMcp!('user');
      expect(result.status).toBe('success');
      expect(result.scope).toBe('user');
      const expected = path.join(os.homedir(), '.codeium', 'windsurf', 'mcp_config.json');
      expect(result.path).toBe(expected);
      const writeCall = mockedWriteFile.mock.calls.find((c) => c[0] === expected);
      expect(writeCall).toBeDefined();
      const written = JSON.parse(writeCall![1]);
      expect(written.mcpServers.pointer).toBeUndefined();
      expect(written.mcpServers.other.command).toBe('node');
      expect(written.unrelated).toBe('keep me');
    });

    it('user scope returns skipped when mcp_config.json missing', async () => {
      (fs.access as jest.Mock).mockReset();
      (fs.access as jest.Mock).mockRejectedValue(Object.assign(new Error(), { code: 'ENOENT' }));
      const result = await windsurfAdapter.unregisterMcp!('user');
      expect(result.status).toBe('skipped');
      expect(result.scope).toBe('user');
    });

    it('user scope returns skipped when pointer key absent', async () => {
      mockedReadFile.mockResolvedValueOnce(JSON.stringify({
        mcpServers: { other: { command: 'node' } },
      }));
      const result = await windsurfAdapter.unregisterMcp!('user');
      expect(result.status).toBe('skipped');
    });

    it('user scope writes back mcpServers:{} when pointer was only key', async () => {
      mockedReadFile.mockResolvedValueOnce(JSON.stringify({
        mcpServers: { pointer: { command: 'old' } },
      }));
      const result = await windsurfAdapter.unregisterMcp!('user');
      expect(result.status).toBe('success');
      const writeCall = mockedWriteFile.mock.calls.find((c) => c[0].endsWith('mcp_config.json'));
      expect(writeCall).toBeDefined();
      const written = JSON.parse(writeCall![1]);
      expect(written.mcpServers).toEqual({});
      expect((fs.unlink as jest.Mock)).not.toHaveBeenCalled();
    });

    it('project scope operates on user file, returns degraded + scope=user on success', async () => {
      mockedReadFile.mockResolvedValueOnce(JSON.stringify({
        mcpServers: {
          other: { command: 'node' },
          pointer: { command: 'old' },
        },
      }));
      const result = await windsurfAdapter.unregisterMcp!('project');
      expect(result.status).toBe('degraded');
      expect(result.scope).toBe('user');
      const expected = path.join(os.homedir(), '.codeium', 'windsurf', 'mcp_config.json');
      expect(result.path).toBe(expected);
      const writeCall = mockedWriteFile.mock.calls.find((c) => c[0] === expected);
      expect(writeCall).toBeDefined();
      const written = JSON.parse(writeCall![1]);
      expect(written.mcpServers.pointer).toBeUndefined();
      expect(written.mcpServers.other.command).toBe('node');
    });
  });
});
