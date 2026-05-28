import path from 'path';
import os from 'os';

jest.mock('fs/promises', () => ({
  mkdir: jest.fn().mockResolvedValue(undefined),
  writeFile: jest.fn().mockResolvedValue(undefined),
  readFile: jest.fn().mockRejectedValue(Object.assign(new Error(), { code: 'ENOENT' })),
}));

import fs from 'fs/promises';
import { opencodeAdapter } from '../../adapters/opencode';

const mockedWriteFile = fs.writeFile as jest.Mock;
const mockedReadFile = fs.readFile as jest.Mock;

beforeEach(() => {
  mockedWriteFile.mockClear();
  mockedReadFile.mockClear();
  mockedReadFile.mockRejectedValue(Object.assign(new Error(), { code: 'ENOENT' }));
});

describe('opencodeAdapter', () => {
  it('installTrigger user writes ~/.config/opencode/commands/pointed.md', async () => {
    const result = await opencodeAdapter.installTrigger('user');
    expect(result.status).toBe('success');
    expect(result.path).toBe(path.join(os.homedir(), '.config', 'opencode', 'commands', 'pointed.md'));
  });

  it('installTrigger project writes <cwd>/.opencode/commands/pointed.md', async () => {
    const result = await opencodeAdapter.installTrigger('project');
    expect(result.status).toBe('success');
    expect(result.path).toBe(path.join(process.cwd(), '.opencode', 'commands', 'pointed.md'));
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
