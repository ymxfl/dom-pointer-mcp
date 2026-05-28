import path from 'path';
import os from 'os';

jest.mock('fs/promises', () => ({
  mkdir: jest.fn().mockResolvedValue(undefined),
  writeFile: jest.fn().mockResolvedValue(undefined),
  readFile: jest.fn().mockRejectedValue(Object.assign(new Error(), { code: 'ENOENT' })),
}));

import fs from 'fs/promises';
import { cursorAdapter } from '../../adapters/cursor';

const mockedWriteFile = fs.writeFile as jest.Mock;

beforeEach(() => { mockedWriteFile.mockClear(); });

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
  });
});
