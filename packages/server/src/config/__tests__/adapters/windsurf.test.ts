import path from 'path';
import os from 'os';

jest.mock('fs/promises', () => ({
  mkdir: jest.fn().mockResolvedValue(undefined),
  writeFile: jest.fn().mockResolvedValue(undefined),
  readFile: jest.fn().mockRejectedValue(Object.assign(new Error(), { code: 'ENOENT' })),
}));

import fs from 'fs/promises';
import { windsurfAdapter } from '../../adapters/windsurf';

const mockedWriteFile = fs.writeFile as jest.Mock;

beforeEach(() => { mockedWriteFile.mockClear(); });

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
