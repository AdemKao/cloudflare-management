import test from 'node:test';
import assert from 'node:assert/strict';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  accountApiTokenPath,
  accountTunnelTokenPath,
  appPaths,
  legacyTunnelTokenPath,
  loadConfig,
  migrateToLatest,
} from '../src/config.js';

async function fixturePaths(prefix = 'cfm-config-') {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), prefix));
  const paths = appPaths({ XDG_CONFIG_HOME: path.join(root, 'config'), XDG_STATE_HOME: path.join(root, 'state') }, root);
  await fsp.mkdir(paths.configRoot, { recursive: true });
  return { root, paths };
}

async function write(filePath, value) {
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
  await fsp.writeFile(filePath, `${value}\n`, { mode: 0o600 });
}

async function missing(filePath) {
  try {
    await fsp.access(filePath);
    return false;
  } catch (error) {
    if (error.code === 'ENOENT') return true;
    throw error;
  }
}

test('v1 config migrates directly to v3 and moves token-only secret into legacy storage', async () => {
  const { paths } = await fixturePaths();
  const oldToken = path.join(paths.configRoot, 'secrets', 'company-a.token');
  await write(oldToken, 'existing-secret');
  await fsp.writeFile(paths.configFile, JSON.stringify({
    version: 1,
    tunnels: {
      'company-a': { tokenFile: oldToken, createdAt: '2026-01-01T00:00:00.000Z' },
    },
  }));

  const config = await loadConfig({ paths });
  const target = legacyTunnelTokenPath('company-a', paths);
  assert.equal(config.version, 3);
  assert.equal(config.tunnels['company-a'].managementMode, 'token-only');
  assert.equal(config.tunnels['company-a'].account, null);
  assert.equal(config.tunnels['company-a'].tunnelId, null);
  assert.equal(config.tunnels['company-a'].tokenFile, target);
  assert.equal((await fsp.readFile(target, 'utf8')).trim(), 'existing-secret');
  assert.equal(await missing(oldToken), true);
  assert.ok((await fsp.stat(paths.v1BackupFile)).isFile());

  const second = await loadConfig({ paths });
  assert.deepEqual(second, config);
});

test('v2 config moves account and managed tunnel credentials into the account boundary', async () => {
  const { paths } = await fixturePaths('cfm-v2-');
  const oldApiToken = path.join(paths.configRoot, 'secrets', 'accounts', 'company-a.api-token');
  const oldManagedToken = path.join(paths.configRoot, 'secrets', 'tunnels', 'project-dev.token');
  const oldLegacyToken = path.join(paths.configRoot, 'secrets', 'company-a.token');
  await write(oldApiToken, 'api-secret');
  await write(oldManagedToken, 'managed-secret');
  await write(oldLegacyToken, 'legacy-secret');
  await fsp.writeFile(paths.configFile, JSON.stringify({
    version: 2,
    accounts: {
      'company-a': {
        accountId: '0123456789abcdef0123456789abcdef',
        apiTokenFile: oldApiToken,
        defaultZoneId: null,
      },
    },
    tunnels: {
      'project-dev': {
        managementMode: 'adopted',
        account: 'company-a',
        tunnelId: '11111111-1111-1111-1111-111111111111',
        remoteName: 'project-dev',
        tokenFile: oldManagedToken,
      },
      'company-a': {
        managementMode: 'token-only',
        account: null,
        tunnelId: null,
        remoteName: null,
        tokenFile: oldLegacyToken,
      },
    },
  }));

  const result = await migrateToLatest({ paths });
  const config = result.config;
  const apiTarget = accountApiTokenPath('company-a', paths);
  const managedTarget = accountTunnelTokenPath('company-a', 'project-dev', paths);
  const legacyTarget = legacyTunnelTokenPath('company-a', paths);

  assert.equal(result.fromVersion, 2);
  assert.equal(result.toVersion, 3);
  assert.equal(config.accounts['company-a'].apiTokenFile, apiTarget);
  assert.equal(config.tunnels['project-dev'].tokenFile, managedTarget);
  assert.equal(config.tunnels['company-a'].tokenFile, legacyTarget);
  assert.equal((await fsp.readFile(apiTarget, 'utf8')).trim(), 'api-secret');
  assert.equal((await fsp.readFile(managedTarget, 'utf8')).trim(), 'managed-secret');
  assert.equal((await fsp.readFile(legacyTarget, 'utf8')).trim(), 'legacy-secret');
  assert.ok((await fsp.stat(paths.v2BackupFile)).isFile());
  assert.equal(await missing(oldApiToken), true);
  assert.equal(await missing(oldManagedToken), true);
  assert.equal(await missing(oldLegacyToken), true);
});

test('v2 migration preview reports moves without changing config or secrets', async () => {
  const { paths } = await fixturePaths('cfm-preview-');
  const oldToken = path.join(paths.configRoot, 'secrets', 'company-a.token');
  await write(oldToken, 'secret');
  const original = {
    version: 2,
    accounts: {},
    tunnels: {
      'company-a': {
        managementMode: 'token-only',
        account: null,
        tunnelId: null,
        remoteName: null,
        tokenFile: oldToken,
      },
    },
  };
  await fsp.writeFile(paths.configFile, JSON.stringify(original));

  const preview = await migrateToLatest({ paths, dryRun: true });
  assert.equal(preview.changed, true);
  assert.equal(preview.actions.length, 1);
  assert.equal(preview.actions[0].destination, legacyTunnelTokenPath('company-a', paths));
  assert.equal(JSON.parse(await fsp.readFile(paths.configFile, 'utf8')).version, 2);
  assert.equal((await fsp.readFile(oldToken, 'utf8')).trim(), 'secret');
  assert.equal(await missing(legacyTunnelTokenPath('company-a', paths)), true);
});

test('v2 migration recovers after a previous partial move', async () => {
  const { paths } = await fixturePaths('cfm-recover-');
  const oldToken = path.join(paths.configRoot, 'secrets', 'company-a.token');
  const destination = legacyTunnelTokenPath('company-a', paths);
  await write(destination, 'secret-already-moved');
  await fsp.writeFile(paths.configFile, JSON.stringify({
    version: 2,
    accounts: {},
    tunnels: {
      'company-a': {
        managementMode: 'token-only',
        account: null,
        tunnelId: null,
        remoteName: null,
        tokenFile: oldToken,
      },
    },
  }));

  const config = await loadConfig({ paths });
  assert.equal(config.version, 3);
  assert.equal(config.tunnels['company-a'].tokenFile, destination);
  assert.equal((await fsp.readFile(destination, 'utf8')).trim(), 'secret-already-moved');
});

test('v2 migration refuses to overwrite a different destination secret', async () => {
  const { paths } = await fixturePaths('cfm-conflict-');
  const oldToken = path.join(paths.configRoot, 'secrets', 'company-a.token');
  const destination = legacyTunnelTokenPath('company-a', paths);
  await write(oldToken, 'source-secret');
  await write(destination, 'different-secret');
  await fsp.writeFile(paths.configFile, JSON.stringify({
    version: 2,
    accounts: {},
    tunnels: {
      'company-a': {
        managementMode: 'token-only',
        account: null,
        tunnelId: null,
        remoteName: null,
        tokenFile: oldToken,
      },
    },
  }));

  await assert.rejects(() => migrateToLatest({ paths }), /destination already exists with different contents/);
  assert.equal(JSON.parse(await fsp.readFile(paths.configFile, 'utf8')).version, 2);
  assert.equal((await fsp.readFile(oldToken, 'utf8')).trim(), 'source-secret');
  assert.equal((await fsp.readFile(destination, 'utf8')).trim(), 'different-secret');
});

test('fresh config starts at schema v3', async () => {
  const { paths } = await fixturePaths('cfm-empty-');
  const config = await loadConfig({ paths });
  assert.deepEqual(config, { version: 3, accounts: {}, tunnels: {} });
});
