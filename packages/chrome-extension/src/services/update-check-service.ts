import { isNewerVersion, parseSemver } from '../utils/semver';

export const GITHUB_REPO = 'ymxfl/dom-pointer-mcp';
export const GITHUB_RELEASES_URL = `https://api.github.com/repos/${GITHUB_REPO}/releases?per_page=30`;
export const EXTENSION_ZIP_NAME = 'dom-pointer-mcp-chrome-extension.zip';
export const CHROME_WEB_STORE_ID = 'jfhgaembhafbffidedhpkmnaajdfeiok';
export const CHROME_WEB_STORE_URL = `https://chromewebstore.google.com/detail/dom-pointer-mcp/${CHROME_WEB_STORE_ID}`;

export type UpdateChannel = 'chrome-web-store' | 'github' | 'auto';
export type UpdateStatus = 'up-to-date' | 'update-available' | 'throttled' | 'error';
export type ResolvedChannel = 'chrome-web-store' | 'github';

export type UpdateMessageKey =
  | 'popup.updateAvailable'
  | 'popup.updateUpToDate'
  | 'popup.updateThrottled'
  | 'popup.updateError'
  | 'popup.updateCwsAvailable';

export interface UpdateCheckResult {
  status: UpdateStatus;
  channel: ResolvedChannel;
  currentVersion: string;
  latestVersion?: string;
  updateUrl?: string;
  messageKey: UpdateMessageKey;
  detail?: string;
}

export type InstallType = 'normal' | 'development' | 'sideload' | 'admin' | 'other' | 'unknown';

export interface GithubReleaseAsset {
  name?: string;
  browser_download_url?: string;
}

export interface GithubRelease {
  tag_name?: string;
  html_url?: string;
  draft?: boolean;
  prerelease?: boolean;
  assets?: GithubReleaseAsset[];
}

export interface GithubLatestExtension {
  version: string;
  releaseUrl: string;
  zipUrl?: string;
}

/**
 * Pick the newest extension release from a GitHub releases list.
 * Extension releases are tagged with a bare semver (e.g. `1.7.4`); server
 * releases use a package-scoped tag (`@dom-pointer-mcp/server@x`) and must be
 * ignored so a server-only release never masks the extension's latest version.
 * @author zgx
 */
export function pickLatestExtensionRelease(
  releases: GithubRelease[],
): GithubLatestExtension | null {
  // Only bare-semver tags belong to the Chrome extension; server releases use a
  // package-scoped tag (`@dom-pointer-mcp/server@x`) and are excluded here.
  const candidates = releases
    .filter((release) => !release.draft && !release.prerelease)
    .filter((release) => /^v?\d+\.\d+\.\d+$/u.test(release.tag_name ?? ''))
    .map((release) => ({ release, version: (release.tag_name ?? '').replace(/^v/u, '') }))
    .filter((candidate) => parseSemver(candidate.version) !== null);

  const best = candidates.reduce<{ release: GithubRelease; version: string } | null>(
    (acc, candidate) => (
      !acc || isNewerVersion(candidate.version, acc.version) ? candidate : acc
    ),
    null,
  );

  if (!best) return null;
  const zip = best.release.assets?.find((asset) => asset.name === EXTENSION_ZIP_NAME);
  return {
    version: best.version,
    releaseUrl: best.release.html_url || `https://github.com/${GITHUB_REPO}/releases/latest`,
    zipUrl: zip?.browser_download_url,
  };
}

export interface UpdateCheckDeps {
  getCurrentVersion: () => string;
  getInstallType: () => Promise<InstallType>;
  requestChromeUpdateCheck: () => Promise<'no_update' | 'update_available' | 'throttled' | 'unsupported'>;
  fetchGithubLatest: () => Promise<{ version: string; releaseUrl: string; zipUrl?: string }>;
}

/**
 * Default Chrome / network dependencies for update checks.
 * @author zgx
 */
export function createDefaultUpdateCheckDeps(): UpdateCheckDeps {
  return {
    getCurrentVersion: () => chrome.runtime.getManifest().version,
    getInstallType: async () => {
      try {
        if (!chrome.management?.getSelf) return 'unknown';
        const self = await chrome.management.getSelf();
        return (self.installType as InstallType) || 'unknown';
      } catch {
        return 'unknown';
      }
    },
    requestChromeUpdateCheck: () => new Promise((resolve) => {
      try {
        if (!chrome.runtime.requestUpdateCheck) {
          resolve('unsupported');
          return;
        }
        chrome.runtime.requestUpdateCheck((status) => {
          if (chrome.runtime.lastError) {
            resolve('unsupported');
            return;
          }
          if (status === 'update_available' || status === 'no_update' || status === 'throttled') {
            resolve(status);
            return;
          }
          resolve('unsupported');
        });
      } catch {
        resolve('unsupported');
      }
    }),
    fetchGithubLatest: async () => {
      const response = await fetch(GITHUB_RELEASES_URL, {
        headers: { Accept: 'application/vnd.github+json' },
      });
      if (!response.ok) {
        throw new Error(`GitHub releases HTTP ${response.status}`);
      }
      const releases = await response.json() as GithubRelease[];
      const latest = pickLatestExtensionRelease(releases);
      if (!latest) {
        throw new Error('No Chrome extension release found');
      }
      return latest;
    },
  };
}

function preferGithubChannel(installType: InstallType): boolean {
  return installType === 'development' || installType === 'sideload';
}

/**
 * Check for Chrome extension updates via CWS and/or GitHub Releases.
 * @author zgx
 */
export async function checkExtensionUpdate(
  channel: UpdateChannel = 'auto',
  deps: UpdateCheckDeps = createDefaultUpdateCheckDeps(),
): Promise<UpdateCheckResult> {
  const currentVersion = deps.getCurrentVersion();
  const installType = await deps.getInstallType();

  const tryChrome = async (): Promise<UpdateCheckResult | null> => {
    const status = await deps.requestChromeUpdateCheck();
    if (status === 'unsupported') return null;
    if (status === 'update_available') {
      return {
        status: 'update-available',
        channel: 'chrome-web-store',
        currentVersion,
        updateUrl: CHROME_WEB_STORE_URL,
        messageKey: 'popup.updateCwsAvailable',
      };
    }
    if (status === 'throttled') {
      return {
        status: 'throttled',
        channel: 'chrome-web-store',
        currentVersion,
        updateUrl: CHROME_WEB_STORE_URL,
        messageKey: 'popup.updateThrottled',
      };
    }
    return {
      status: 'up-to-date',
      channel: 'chrome-web-store',
      currentVersion,
      latestVersion: currentVersion,
      updateUrl: CHROME_WEB_STORE_URL,
      messageKey: 'popup.updateUpToDate',
    };
  };

  const tryGithub = async (): Promise<UpdateCheckResult> => {
    try {
      const latest = await deps.fetchGithubLatest();
      if (isNewerVersion(latest.version, currentVersion)) {
        return {
          status: 'update-available',
          channel: 'github',
          currentVersion,
          latestVersion: latest.version,
          updateUrl: latest.zipUrl || latest.releaseUrl,
          messageKey: 'popup.updateAvailable',
        };
      }
      return {
        status: 'up-to-date',
        channel: 'github',
        currentVersion,
        latestVersion: latest.version,
        updateUrl: latest.releaseUrl,
        messageKey: 'popup.updateUpToDate',
      };
    } catch (error) {
      return {
        status: 'error',
        channel: 'github',
        currentVersion,
        messageKey: 'popup.updateError',
        detail: (error as Error).message,
      };
    }
  };

  if (channel === 'chrome-web-store') {
    return (await tryChrome()) ?? {
      status: 'error',
      channel: 'chrome-web-store',
      currentVersion,
      messageKey: 'popup.updateError',
      detail: 'Chrome Web Store update check unavailable',
    };
  }

  if (channel === 'github') {
    return tryGithub();
  }

  // auto
  if (preferGithubChannel(installType)) {
    return tryGithub();
  }

  const cwsResult = await tryChrome();
  if (cwsResult?.status === 'update-available') {
    return cwsResult;
  }

  const githubResult = await tryGithub();
  if (githubResult.status === 'update-available' || githubResult.status === 'up-to-date') {
    return githubResult;
  }

  // GitHub failed — fall back to CWS result if any
  if (cwsResult) {
    return cwsResult;
  }
  return githubResult;
}
