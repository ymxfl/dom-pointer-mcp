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
  it('installTrigger user scope writes ~/.cursor/rules/pointed.mdc', async () => {
    const result = await cursorAdapter.installTrigger('user');
    expect(result.status).toBe('success');
    expect(result.path).toBe(path.join(os.homedir(), '.cursor', 'rules', 'pointed.mdc'));
    expect(mockedWriteFile).toHaveBeenCalledWith(
      expect.stringContaining('pointed.mdc'),
      expect.stringContaining('description:'),
      'utf8',
    );
  });

  it('installTrigger project scope writes <cwd>/.cursor/rules/pointed.mdc', async () => {
    const result = await cursorAdapter.installTrigger('project');
    expect(result.status).toBe('success');
    expect(result.path).toBe(path.join(process.cwd(), '.cursor', 'rules', 'pointed.mdc'));
  });

  it('registerMcp project scope writes .cursor/mcp.json with pointer entry', async () => {
    const result = await cursorAdapter.registerMcp('project', 7007);
    expect(result.status).toBe('success');
    expect(result.path).toBe(path.join(process.cwd(), '.cursor', 'mcp.json'));
    const written = JSON.parse(mockedWriteFile.mock.calls[0][1]);
    expect(written.mcpServers.pointer.env.MCP_POINTER_PORT).toBe('7007');
  });
});
