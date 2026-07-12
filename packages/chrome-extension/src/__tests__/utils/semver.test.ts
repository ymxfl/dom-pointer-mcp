import { compareSemver, isNewerVersion, parseSemver } from '../../utils/semver';

describe('parseSemver', () => {
  it('parses plain semver', () => {
    expect(parseSemver('1.6.1')).toEqual({ major: 1, minor: 6, patch: 1 });
  });

  it('strips leading v', () => {
    expect(parseSemver('v2.0.0')).toEqual({ major: 2, minor: 0, patch: 0 });
  });

  it('returns null for invalid input', () => {
    expect(parseSemver('latest')).toBeNull();
    expect(parseSemver('')).toBeNull();
  });
});

describe('compareSemver', () => {
  it('returns negative when a < b', () => {
    expect(compareSemver('1.0.0', '1.0.1')).toBeLessThan(0);
  });

  it('returns positive when a > b', () => {
    expect(compareSemver('2.0.0', '1.9.9')).toBeGreaterThan(0);
  });

  it('returns 0 when equal', () => {
    expect(compareSemver('1.6.1', '1.6.1')).toBe(0);
  });

  it('throws on invalid versions', () => {
    expect(() => compareSemver('x', '1.0.0')).toThrow();
  });
});

describe('isNewerVersion', () => {
  it('is true when latest is newer', () => {
    expect(isNewerVersion('1.7.0', '1.6.1')).toBe(true);
  });

  it('is false when latest is same or older', () => {
    expect(isNewerVersion('1.6.1', '1.6.1')).toBe(false);
    expect(isNewerVersion('1.5.0', '1.6.1')).toBe(false);
  });
});
