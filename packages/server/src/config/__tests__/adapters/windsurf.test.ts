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
  it('installTrigger user appends to ~/.codeium/windsurf/global_rules.md', async () => {
    const result = await windsurfAdapter.installTrigger('user');
    expect(result.status).toBe('success');
    expect(result.path).toBe(
      path.join(os.homedir(), '.codeium', 'windsurf', 'global_rules.md'),
    );
  });

  it('installTrigger project writes <cwd>/.windsurf/rules/pointed.md', async () => {
    const result = await windsurfAdapter.installTrigger('project');
    expect(result.status).toBe('success');
    expect(result.path).toBe(
      path.join(process.cwd(), '.windsurf', 'rules', 'pointed.md'),
    );
  });

  it('registerMcp user writes ~/.codeium/windsurf/mcp_config.json', async () => {
    const result = await windsurfAdapter.registerMcp('user', 7007);
    expect(result.status).toBe('success');
    expect(result.path).toBe(
      path.join(os.homedir(), '.codeium', 'windsurf', 'mcp_config.json'),
    );
  });

  it('registerMcp project degrades to user scope with warning', async () => {
    const result = await windsurfAdapter.registerMcp('project', 7007);
    expect(result.status).toBe('degraded');
    expect(result.scope).toBe('user');
    expect(result.message).toMatch(/does not support project-level/i);
  });
});
