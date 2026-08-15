import test from 'node:test';
import assert from 'node:assert/strict';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { appPaths, loadConfig } from '../src/config.js';

test('v1 config migrates atomically to token-only v2 while preserving token path', async () => {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), 'cfm-config-'));
  const paths = appPaths({ XDG_CONFIG_HOME: path.join(root, 'config'), XDG_STATE_HOME: path.join(root, 'state') }, root);
  await fsp.mkdir(paths.configRoot, { recursive: true });
  const oldToken = path.join(paths.configRoot, 'secrets', 'company-a.token');
  await fsp.mkdir(path.dirname(oldToken), { recursive: true });
  await fsp.writeFile(oldToken, 'existing-secret\n', { mode: 0o600 });
  await fsp.writeFile(paths.configFile, JSON.stringify({
    version: 1,
    tunnels: {
      'company-a': { tokenFile: oldToken, createdAt: '2026-01-01T00:00:00.000Z' },
    },
  }));

  const config = await loadConfig({ paths });
  assert.equal(config.version, 2);
  assert.equal(config.tunnels['company-a'].managementMode, 'token-only');
  assert.equal(config.tunnels['company-a'].account, null);
  assert.equal(config.tunnels['company-a'].tunnelId, null);
  assert.equal(config.tunnels['company-a'].tokenFile, oldToken);
  assert.equal((await fsp.readFile(oldToken, 'utf8')).trim(), 'existing-secret');
  assert.ok((await fsp.stat(paths.backupFile)).isFile());

  const second = await loadConfig({ paths });
  assert.deepEqual(second, config);
});

test('fresh config starts at schema v2', async () => {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), 'cfm-empty-'));
  const paths = appPaths({ XDG_CONFIG_HOME: path.join(root, 'config'), XDG_STATE_HOME: path.join(root, 'state') }, root);
  const config = await loadConfig({ paths });
  assert.deepEqual(config, { version: 2, accounts: {}, tunnels: {} });
});
