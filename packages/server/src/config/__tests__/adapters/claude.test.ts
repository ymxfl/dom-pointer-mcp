import path from 'path';
import os from 'os';

jest.mock('fs/promises', () => ({
  mkdir: jest.fn().mockResolvedValue(undefined),
  writeFile: jest.fn().mockResolvedValue(undefined),
  readFile: jest.fn().mockRejectedValue(Object.assign(new Error(), { code: 'ENOENT' })),
}));

jest.mock('child_process', () => ({
  execSync: jest.fn(),
}));

import fs from 'fs/promises';
import { execSync } from 'child_process';
import { claudeAdapter } from '../../adapters/claude';

const mockedWriteFile = fs.writeFile as jest.Mock;
const mockedExecSync = execSync as jest.Mock;

beforeEach(() => {
  mockedWriteFile.mockClear();
  mockedExecSync.mockClear();
  mockedExecSync.mockReturnValue('');
});

describe('claudeAdapter', () => {
  it('installTrigger user scope writes ~/.claude/skills/pointed/SKILL.md', async () => {
    const result = await claudeAdapter.installTrigger('user');
    expect(result.status).toBe('success');
    const expectedPath = path.join(os.homedir(), '.claude', 'skills', 'pointed', 'SKILL.md');
    expect(result.path).toBe(expectedPath);
    expect(mockedWriteFile).toHaveBeenCalledWith(expectedPath, expect.stringContaining('name: pointed'), 'utf8');
  });

  it('installTrigger project scope writes <cwd>/.claude/skills/pointed/SKILL.md', async () => {
    const result = await claudeAdapter.installTrigger('project');
    expect(result.status).toBe('success');
    const expectedPath = path.join(process.cwd(), '.claude', 'skills', 'pointed', 'SKILL.md');
    expect(result.path).toBe(expectedPath);
  });

  it('registerMcp project scope writes .mcp.json with pointer entry', async () => {
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

  it('registerMcp user scope runs claude mcp add CLI', async () => {
    const result = await claudeAdapter.registerMcp('user', 7007);
    expect(result.status).toBe('success');
    const addCall = mockedExecSync.mock.calls.find(
      (call) => String(call[0]).includes('claude mcp add'),
    );
    expect(addCall).toBeDefined();
    expect(String(addCall![0])).toContain('MCP_POINTER_PORT=7007');
  });
});
