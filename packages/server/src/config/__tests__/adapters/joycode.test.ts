import path from 'path';
import os from 'os';

import fs from 'fs/promises';
import { joycodeAdapter } from '../../adapters/joycode';

jest.mock('fs/promises', () => ({
  mkdir: jest.fn().mockResolvedValue(undefined),
  writeFile: jest.fn().mockResolvedValue(undefined),
  readFile: jest.fn().mockRejectedValue(Object.assign(new Error(), { code: 'ENOENT' })),
  unlink: jest.fn().mockResolvedValue(undefined),
  rm: jest.fn().mockResolvedValue(undefined),
  access: jest.fn().mockResolvedValue(undefined),
}));

const mockedWriteFile = fs.writeFile as jest.Mock;
const mockedReadFile = fs.readFile as jest.Mock;
const mockedUnlink = fs.unlink as jest.Mock;
const mockedRm = fs.rm as jest.Mock;
const mockedAccess = fs.access as jest.Mock;

beforeEach(() => {
  mockedWriteFile.mockReset();
  mockedWriteFile.mockResolvedValue(undefined);
  mockedReadFile.mockReset();
  mockedReadFile.mockRejectedValue(Object.assign(new Error(), { code: 'ENOENT' }));
  mockedUnlink.mockReset();
  mockedUnlink.mockResolvedValue(undefined);
  mockedRm.mockReset();
  mockedRm.mockResolvedValue(undefined);
  mockedAccess.mockReset();
  mockedAccess.mockResolvedValue(undefined);
});

describe('joycodeAdapter', () => {
  describe('registerMcp', () => {
    it('user writes ~/.joycode/joycode-mcp.json', async () => {
      const result = await joycodeAdapter.registerMcp('user', 7007);
      expect(result.status).toBe('success');
      expect(result.path).toBe(path.join(os.homedir(), '.joycode', 'joycode-mcp.json'));
    });

    it('project writes <cwd>/.joycode/mcp.json', async () => {
      const result = await joycodeAdapter.registerMcp('project', 7007);
      expect(result.status).toBe('success');
      expect(result.path).toBe(path.join(process.cwd(), '.joycode', 'mcp.json'));
    });

    it('user merges into existing joycode-mcp.json preserving other servers', async () => {
      mockedReadFile.mockResolvedValueOnce(JSON.stringify({
        mcpServers: {
          'joycode-resources': { command: 'npx', args: ['@joycode-ide/resources-mcp'] },
        },
      }));
      const result = await joycodeAdapter.registerMcp('user', 7007);
      expect(result.status).toBe('success');
      const written = JSON.parse(mockedWriteFile.mock.calls[0][1]);
      expect(written.mcpServers['joycode-resources'].command).toBe('npx');
      expect(written.mcpServers['dom-pointer'].env.MCP_POINTER_PORT).toBe('7007');
    });
  });

  describe('installCommand', () => {
    it('project merges into <cwd>/.joycode/prompt.json keeping other entries', async () => {
      mockedReadFile.mockResolvedValueOnce(JSON.stringify([
        { name: 'someOtherCommand', label: 'Other', prompt: 'x' },
        { name: 'pointerOld', label: 'Old', prompt: 'stale' },
      ]));
      const result = await joycodeAdapter.installCommand!('project');
      expect(result.status).toBe('success');
      expect(result.scope).toBe('project');
      expect(result.path).toBe(path.join(process.cwd(), '.joycode', 'prompt.json'));
      const written = JSON.parse(mockedWriteFile.mock.calls[0][1]);
      expect(Array.isArray(written)).toBe(true);
      const names = written.map((e: any) => e.name);
      expect(names).toContain('someOtherCommand');
      expect(names).not.toContain('pointerOld');
      expect(names).toContain('pointerPointed');
      const pointer = written.find((e: any) => e.name === 'pointerPointed');
      expect(pointer.source).toBe('project');
    });

    it('user writes ~/.joycode/prompt.json with source=user', async () => {
      const result = await joycodeAdapter.installCommand!('user');
      expect(result.status).toBe('success');
      expect(result.scope).toBe('user');
      expect(result.path).toBe(path.join(os.homedir(), '.joycode', 'prompt.json'));
      const written = JSON.parse(mockedWriteFile.mock.calls[0][1]);
      const pointer = written.find((e: any) => e.name === 'pointerPointed');
      expect(pointer.source).toBe('user');
    });
  });

  describe('installSkill', () => {
    it('user writes ~/.joycode/skills/pointed/SKILL.md', async () => {
      const result = await joycodeAdapter.installSkill!('user');
      expect(result.status).toBe('success');
      expect(result.path).toBe(path.join(os.homedir(), '.joycode', 'skills', 'pointed', 'SKILL.md'));
      const writeCall = mockedWriteFile.mock.calls.find((c) => String(c[0]).endsWith('SKILL.md'));
      expect(writeCall).toBeDefined();
      expect(String(writeCall![1])).toContain('name: pointed');
    });

    it('project writes <cwd>/.joycode/skills/pointed/SKILL.md', async () => {
      const result = await joycodeAdapter.installSkill!('project');
      expect(result.status).toBe('success');
      expect(result.path).toBe(path.join(process.cwd(), '.joycode', 'skills', 'pointed', 'SKILL.md'));
    });
  });
});

describe('joycodeAdapter uninstall', () => {
  describe('uninstallSkill', () => {
    it('user scope removes ~/.joycode/skills/pointed directory', async () => {
      const result = await joycodeAdapter.uninstallSkill!('user');
      expect(result.status).toBe('success');
      const expected = path.join(os.homedir(), '.joycode', 'skills', 'pointed');
      expect(result.path).toBe(expected);
      expect(mockedRm).toHaveBeenCalledWith(expected, { recursive: true, force: false });
    });

    it('project scope removes <cwd>/.joycode/skills/pointed directory', async () => {
      const result = await joycodeAdapter.uninstallSkill!('project');
      expect(result.status).toBe('success');
      const expected = path.join(process.cwd(), '.joycode', 'skills', 'pointed');
      expect(result.path).toBe(expected);
      expect(mockedRm).toHaveBeenCalledWith(expected, { recursive: true, force: false });
    });

    it('returns skipped when skill directory is missing', async () => {
      mockedRm.mockRejectedValueOnce(Object.assign(new Error(), { code: 'ENOENT' }));
      const result = await joycodeAdapter.uninstallSkill!('user');
      expect(result.status).toBe('skipped');
    });
  });

  describe('unregisterMcp', () => {
    it('user removes mcpServers.dom-pointer from ~/.joycode/joycode-mcp.json, preserves siblings', async () => {
      mockedReadFile.mockResolvedValueOnce(JSON.stringify({
        mcpServers: {
          'joycode-resources': { command: 'npx', args: ['@joycode-ide/resources-mcp'] },
          'dom-pointer': { command: 'old' },
        },
        unrelated: 'keep me',
      }));
      const result = await joycodeAdapter.unregisterMcp('user');
      expect(result.status).toBe('success');
      const expectedPath = path.join(os.homedir(), '.joycode', 'joycode-mcp.json');
      expect(result.path).toBe(expectedPath);
      const writeCall = mockedWriteFile.mock.calls.find((c) => c[0] === expectedPath);
      expect(writeCall).toBeDefined();
      const written = JSON.parse(writeCall![1]);
      expect(written.mcpServers['dom-pointer']).toBeUndefined();
      expect(written.mcpServers['joycode-resources'].command).toBe('npx');
      expect(written.unrelated).toBe('keep me');
    });

    it('project removes mcpServers.dom-pointer from <cwd>/.joycode/mcp.json', async () => {
      mockedReadFile.mockResolvedValueOnce(JSON.stringify({
        mcpServers: {
          other: { command: 'node' },
          'dom-pointer': { command: 'old' },
        },
      }));
      const result = await joycodeAdapter.unregisterMcp('project');
      expect(result.status).toBe('success');
      const expectedPath = path.join(process.cwd(), '.joycode', 'mcp.json');
      expect(result.path).toBe(expectedPath);
      const writeCall = mockedWriteFile.mock.calls.find((c) => c[0] === expectedPath);
      const written = JSON.parse(writeCall![1]);
      expect(written.mcpServers['dom-pointer']).toBeUndefined();
      expect(written.mcpServers.other.command).toBe('node');
    });

    it('returns skipped when the file is missing', async () => {
      mockedAccess.mockRejectedValueOnce(Object.assign(new Error(), { code: 'ENOENT' }));
      mockedReadFile.mockRejectedValueOnce(Object.assign(new Error(), { code: 'ENOENT' }));
      const result = await joycodeAdapter.unregisterMcp('user');
      expect(result.status).toBe('skipped');
    });

    it('returns skipped when pointer key is absent', async () => {
      mockedReadFile.mockResolvedValueOnce(JSON.stringify({
        mcpServers: { other: { command: 'node' } },
      }));
      const result = await joycodeAdapter.unregisterMcp('project');
      expect(result.status).toBe('skipped');
    });
  });

  describe('uninstallCommand', () => {
    it('project removes pointer-prefixed entries and preserves others', async () => {
      mockedReadFile.mockResolvedValueOnce(JSON.stringify([
        { name: 'pointerPointed', label: 'p', prompt: 'x' },
        { name: 'other', label: 'o', prompt: 'y' },
      ]));
      const result = await joycodeAdapter.uninstallCommand!('project');
      expect(result.status).toBe('success');
      expect(result.scope).toBe('project');
      const expectedPath = path.join(process.cwd(), '.joycode', 'prompt.json');
      expect(result.path).toBe(expectedPath);
      const writeCall = mockedWriteFile.mock.calls.find((c) => c[0] === expectedPath);
      const written = JSON.parse(writeCall![1]);
      expect(written.length).toBe(1);
      expect(written[0].name).toBe('other');
    });

    it('project leaves [] when only pointerPointed entry present', async () => {
      mockedReadFile.mockResolvedValueOnce(JSON.stringify([
        { name: 'pointerPointed', label: 'p', prompt: 'x' },
      ]));
      const result = await joycodeAdapter.uninstallCommand!('project');
      expect(result.status).toBe('success');
      const expectedPath = path.join(process.cwd(), '.joycode', 'prompt.json');
      const writeCall = mockedWriteFile.mock.calls.find((c) => c[0] === expectedPath);
      const written = JSON.parse(writeCall![1]);
      expect(written).toEqual([]);
    });

    it('returns skipped when prompt.json is missing', async () => {
      mockedAccess.mockRejectedValueOnce(Object.assign(new Error(), { code: 'ENOENT' }));
      mockedReadFile.mockRejectedValueOnce(Object.assign(new Error(), { code: 'ENOENT' }));
      const result = await joycodeAdapter.uninstallCommand!('project');
      expect(result.status).toBe('skipped');
    });

    it('returns skipped when no pointer-prefixed entry exists', async () => {
      mockedReadFile.mockResolvedValueOnce(JSON.stringify([
        { name: 'other', label: 'o', prompt: 'y' },
      ]));
      const result = await joycodeAdapter.uninstallCommand!('project');
      expect(result.status).toBe('skipped');
    });

    it('user scope removes pointer-prefixed entries from ~/.joycode/prompt.json', async () => {
      mockedReadFile.mockResolvedValueOnce(JSON.stringify([
        { name: 'pointerPointed', label: 'p', prompt: 'x' },
        { name: 'other', label: 'o', prompt: 'y' },
      ]));
      const result = await joycodeAdapter.uninstallCommand!('user');
      expect(result.status).toBe('success');
      expect(result.scope).toBe('user');
      const expectedPath = path.join(os.homedir(), '.joycode', 'prompt.json');
      expect(result.path).toBe(expectedPath);
      const writeCall = mockedWriteFile.mock.calls.find((c) => c[0] === expectedPath);
      const written = JSON.parse(writeCall![1]);
      expect(written.length).toBe(1);
      expect(written[0].name).toBe('other');
    });
  });
});
