import fsp from 'node:fs/promises';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const REPOSITORY = 'AdemKao/cloudflare-management';
const PACKAGE_NAME = 'cloudflare-management';
const HOMEBREW_FORMULA = 'cloudflare-management';

function packageRoot() {
  return path.dirname(path.dirname(fileURLToPath(import.meta.url)));
}

async function realpathOrSelf(value) {
  try {
    return await fsp.realpath(value);
  } catch {
    return path.resolve(value);
  }
}

export async function detectInstallManager({ root = packageRoot(), execFile = execFileSync } = {}) {
  const resolvedRoot = await realpathOrSelf(root);
  const normalized = resolvedRoot.split(path.sep).join('/');
  if (/\/(Cellar|homebrew)\//i.test(normalized)) return 'brew';

  try {
    const npmRoot = String(execFile('npm', ['root', '-g'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })).trim();
    if (npmRoot) {
      const installedRoot = await realpathOrSelf(path.join(npmRoot, PACKAGE_NAME));
      if (installedRoot === resolvedRoot) return 'npm';
    }
  } catch {
    // Unknown/development installs intentionally fall through instead of guessing.
  }

  return 'unknown';
}

export function parseSemver(version) {
  const match = String(version).trim().replace(/^v/, '').match(/^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/);
  if (!match) return null;
  return match.slice(1).map(Number);
}

export function compareSemver(left, right) {
  const a = parseSemver(left);
  const b = parseSemver(right);
  if (!a || !b) return null;
  for (let index = 0; index < 3; index += 1) {
    if (a[index] > b[index]) return 1;
    if (a[index] < b[index]) return -1;
  }
  return 0;
}

export async function latestReleaseTag({ fetchImpl = globalThis.fetch } = {}) {
  if (typeof fetchImpl !== 'function') throw new Error('A fetch implementation is required to resolve the latest release.');
  const response = await fetchImpl(`https://api.github.com/repos/${REPOSITORY}/releases/latest`, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'cloudflare-management-upgrade',
    },
  });
  if (!response.ok) throw new Error(`Could not resolve the latest GitHub Release (HTTP ${response.status}).`);
  const payload = await response.json();
  if (!/^v\d+\.\d+\.\d+/.test(payload?.tag_name ?? '')) throw new Error('Latest GitHub Release did not contain a valid version tag.');
  return payload.tag_name;
}

export async function buildUpgradePlan({
  currentVersion,
  manager = 'unknown',
  channel = 'release',
  fetchImpl = globalThis.fetch,
} = {}) {
  if (!['release', 'main'].includes(channel)) throw new Error('Upgrade channel must be "release" or "main".');
  if (!['npm', 'brew', 'unknown'].includes(manager)) throw new Error('Upgrade manager must be "npm" or "brew".');

  if (manager === 'unknown') {
    return {
      manager,
      channel,
      supported: false,
      reason: 'Could not safely identify an npm or Homebrew-managed installation.',
      manual: `npm install -g github:${REPOSITORY}`,
    };
  }

  if (manager === 'brew') {
    if (channel !== 'release') throw new Error('Homebrew upgrades support the release channel only.');
    return {
      manager,
      channel,
      supported: true,
      executable: 'brew',
      args: ['upgrade', HOMEBREW_FORMULA],
      display: `brew upgrade ${HOMEBREW_FORMULA}`,
      latestVersion: null,
      upToDate: false,
    };
  }

  if (channel === 'main') {
    return {
      manager,
      channel,
      supported: true,
      executable: 'npm',
      args: ['install', '-g', `github:${REPOSITORY}`],
      display: `npm install -g github:${REPOSITORY}`,
      latestVersion: null,
      upToDate: false,
    };
  }

  const tag = await latestReleaseTag({ fetchImpl });
  const comparison = compareSemver(currentVersion, tag);
  return {
    manager,
    channel,
    supported: true,
    executable: 'npm',
    args: ['install', '-g', `github:${REPOSITORY}#${tag}`],
    display: `npm install -g github:${REPOSITORY}#${tag}`,
    latestVersion: tag.replace(/^v/, ''),
    tag,
    upToDate: comparison != null && comparison >= 0,
  };
}

export function executeUpgrade(plan, { spawn = spawnSync, runMigration = true } = {}) {
  if (!plan?.supported) throw new Error(plan?.reason || 'This installation cannot be upgraded automatically.');
  if (plan.upToDate) return { updated: false, migrated: false, status: 0 };

  const result = spawn(plan.executable, plan.args, { stdio: 'inherit', shell: false });
  if (result.error) throw new Error(`Upgrade command failed to start: ${result.error.message}`);
  if (result.status !== 0) throw new Error(`Upgrade command exited with status ${result.status}.`);

  let migrated = false;
  if (runMigration) {
    const migration = spawn('cfm', ['migrate'], { stdio: 'inherit', shell: false });
    if (migration.error) {
      throw new Error(`Package update succeeded, but post-upgrade migration could not start: ${migration.error.message}. Run "cfm migrate" manually.`);
    }
    if (migration.status !== 0) {
      throw new Error(`Package update succeeded, but post-upgrade migration exited with status ${migration.status}. Run "cfm migrate" manually.`);
    }
    migrated = true;
  }

  return { updated: true, migrated, status: 0 };
}

export const upgradeMetadata = {
  repository: REPOSITORY,
  packageName: PACKAGE_NAME,
  homebrewFormula: HOMEBREW_FORMULA,
};
