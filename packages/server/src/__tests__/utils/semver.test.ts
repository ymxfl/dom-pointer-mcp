import { compareSemver, isNewerVersion, parseSemver } from '../../utils/semver';

describe('server semver helpers', () => {
  it('parses and compares versions', () => {
    expect(parseSemver('v1.2.3')).toEqual({ major: 1, minor: 2, patch: 3 });
    expect(compareSemver('1.2.3', '1.2.3')).toBe(0);
    expect(isNewerVersion('1.3.0', '1.2.9')).toBe(true);
  });
});
