import path from 'path';
import os from 'os';

jest.mock('fs/promises', () => ({
  mkdir: jest.fn().mockResolvedValue(undefined),
  writeFile: jest.fn().mockResolvedValue(undefined),
  readFile: jest.fn().mockRejectedValue(Object.assign(new Error(), { code: 'ENOENT' })),
}));

import fs from 'fs/promises';
import { joycodeAdapter } from '../../adapters/joycode';

const mockedWriteFile = fs.writeFile as jest.Mock;
const mockedReadFile = fs.readFile as jest.Mock;

beforeEach(() => {
  mockedWriteFile.mockClear();
  mockedReadFile.mockClear();
  mockedReadFile.mockRejectedValue(Object.assign(new Error(), { code: 'ENOENT' }));
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
      expect(written.mcpServers.pointer.env.MCP_POINTER_PORT).toBe('7007');
    });
  });

  describe('installCommand', () => {
    it('project merges into prompt.json keeping other entries', async () => {
      mockedReadFile.mockResolvedValueOnce(JSON.stringify([
        { name: 'someOtherCommand', label: 'Other', prompt: 'x' },
        { name: 'pointerOld', label: 'Old', prompt: 'stale' },
      ]));
      const result = await joycodeAdapter.installCommand('project');
      expect(result.status).toBe('success');
      expect(result.path).toBe(path.join(process.cwd(), '.joycode', 'prompt.json'));
      const written = JSON.parse(mockedWriteFile.mock.calls[0][1]);
      expect(Array.isArray(written)).toBe(true);
      const names = written.map((e: any) => e.name);
      expect(names).toContain('someOtherCommand');
      expect(names).not.toContain('pointerOld');
      expect(names).toContain('pointerPointed');
    });

    it('user degrades to project scope', async () => {
      const result = await joycodeAdapter.installCommand('user');
      expect(result.status).toBe('degraded');
      expect(result.scope).toBe('project');
      expect(result.message).toMatch(/only supports project-level/i);
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
