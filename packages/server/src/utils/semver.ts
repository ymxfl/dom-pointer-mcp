export interface SemverParts {
  major: number;
  minor: number;
  patch: number;
}

/**
 * Parse a semver-ish string like `1.6.1` or `v1.6.1`.
 * @author zgx
 */
export function parseSemver(version: string): SemverParts | null {
  const match = String(version).trim().match(/^v?(\d+)\.(\d+)\.(\d+)/);
  if (!match) return null;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
}

/**
 * Compare two semver strings. Returns negative if a < b, 0 if equal, positive if a > b.
 * @author zgx
 */
export function compareSemver(a: string, b: string): number {
  const left = parseSemver(a);
  const right = parseSemver(b);
  if (!left || !right) {
    throw new Error(`Invalid semver: "${a}" vs "${b}"`);
  }
  if (left.major !== right.major) return left.major - right.major;
  if (left.minor !== right.minor) return left.minor - right.minor;
  return left.patch - right.patch;
}

/**
 * Whether `latest` is strictly newer than `current`.
 * @author zgx
 */
export function isNewerVersion(latest: string, current: string): boolean {
  return compareSemver(latest, current) > 0;
}
