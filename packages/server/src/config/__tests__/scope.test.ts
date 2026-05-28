import { resolveScope } from '../scope';

describe('resolveScope', () => {
  const originalIsTTY = process.stdin.isTTY;
  afterEach(() => {
    Object.defineProperty(process.stdin, 'isTTY', {
      value: originalIsTTY, configurable: true,
    });
  });

  it("returns 'user' when --scope=user", async () => {
    await expect(resolveScope('user')).resolves.toBe('user');
  });

  it("returns 'project' when --scope=project", async () => {
    await expect(resolveScope('project')).resolves.toBe('project');
  });

  it('throws on invalid scope value', async () => {
    await expect(resolveScope('foo')).rejects.toThrow(/Invalid --scope/);
  });

  it('throws when no scope and no TTY', async () => {
    Object.defineProperty(process.stdin, 'isTTY', {
      value: false, configurable: true,
    });
    await expect(resolveScope()).rejects.toThrow(/No --scope/);
  });
});
