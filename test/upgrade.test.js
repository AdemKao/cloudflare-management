import test from 'node:test';
import assert from 'node:assert/strict';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  buildUpgradePlan,
  compareSemver,
  detectInstallManager,
  executeUpgrade,
  latestReleaseTag,
} from '../src/upgrade.js';

function releaseResponse(tagName, status = 200) {
  return new Response(JSON.stringify({ tag_name: tagName }), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

test('semver comparison handles release tags', () => {
  assert.equal(compareSemver('0.3.0', 'v0.2.2'), 1);
  assert.equal(compareSemver('v0.3.0', '0.3.0'), 0);
  assert.equal(compareSemver('0.2.2', 'v0.3.0'), -1);
});

test('latest release resolver reads GitHub tag_name', async () => {
  const tag = await latestReleaseTag({ fetchImpl: async (url, options) => {
    assert.match(url, /AdemKao\/cloudflare-management\/releases\/latest$/);
    assert.equal(options.headers['User-Agent'], 'cloudflare-management-upgrade');
    return releaseResponse('v0.3.0');
  } });
  assert.equal(tag, 'v0.3.0');
});

test('npm release upgrade pins the latest GitHub Release tag', async () => {
  const plan = await buildUpgradePlan({
    currentVersion: '0.2.2',
    manager: 'npm',
    channel: 'release',
    fetchImpl: async () => releaseResponse('v0.3.0'),
  });
  assert.equal(plan.supported, true);
  assert.equal(plan.upToDate, false);
  assert.equal(plan.latestVersion, '0.3.0');
  assert.deepEqual(plan.args, ['install', '-g', 'github:AdemKao/cloudflare-management#v0.3.0']);
});

test('npm release upgrade is a no-op when already current', async () => {
  const plan = await buildUpgradePlan({
    currentVersion: '0.3.0',
    manager: 'npm',
    channel: 'release',
    fetchImpl: async () => releaseResponse('v0.3.0'),
  });
  assert.equal(plan.upToDate, true);
});

test('main channel uses the GitHub repository without a release tag', async () => {
  const plan = await buildUpgradePlan({ currentVersion: '0.3.0', manager: 'npm', channel: 'main' });
  assert.equal(plan.latestVersion, null);
  assert.deepEqual(plan.args, ['install', '-g', 'github:AdemKao/cloudflare-management']);
});

test('Homebrew adapter uses brew upgrade and rejects the main channel', async () => {
  const plan = await buildUpgradePlan({ currentVersion: '0.3.0', manager: 'brew', channel: 'release' });
  assert.deepEqual(plan.args, ['upgrade', 'cloudflare-management']);
  await assert.rejects(
    () => buildUpgradePlan({ currentVersion: '0.3.0', manager: 'brew', channel: 'main' }),
    /release channel only/,
  );
});

test('unknown install manager refuses automatic replacement', async () => {
  const plan = await buildUpgradePlan({ currentVersion: '0.3.0', manager: 'unknown' });
  assert.equal(plan.supported, false);
  assert.match(plan.manual, /npm install -g/);
});

test('detect install manager recognizes Homebrew Cellar paths without guessing npm', async () => {
  const manager = await detectInstallManager({
    root: '/opt/homebrew/Cellar/cloudflare-management/0.3.0/libexec/lib/node_modules/cloudflare-management',
    execFile: () => { throw new Error('npm should not be called'); },
  });
  assert.equal(manager, 'brew');
});

test('detect install manager recognizes an npm global package root', async () => {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), 'cfm-upgrade-'));
  const npmRoot = path.join(root, 'npm-global');
  const installed = path.join(npmRoot, 'cloudflare-management');
  await fsp.mkdir(installed, { recursive: true });
  const manager = await detectInstallManager({
    root: installed,
    execFile: (command, args) => {
      assert.equal(command, 'npm');
      assert.deepEqual(args, ['root', '-g']);
      return `${npmRoot}\n`;
    },
  });
  assert.equal(manager, 'npm');
});

test('executeUpgrade never uses a shell and runs post-upgrade migration', () => {
  const calls = [];
  const spawn = (command, args, options) => {
    calls.push({ command, args, options });
    return { status: 0 };
  };
  const result = executeUpgrade({
    supported: true,
    upToDate: false,
    executable: 'npm',
    args: ['install', '-g', 'github:AdemKao/cloudflare-management#v0.3.0'],
  }, { spawn });

  assert.equal(result.updated, true);
  assert.equal(result.migrated, true);
  assert.deepEqual(calls.map((call) => [call.command, call.args]), [
    ['npm', ['install', '-g', 'github:AdemKao/cloudflare-management#v0.3.0']],
    ['cfm', ['migrate']],
  ]);
  assert.equal(calls.every((call) => call.options.shell === false), true);
});
