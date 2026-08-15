import test from 'node:test';
import assert from 'node:assert/strict';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { appPaths, saveConfig } from '../src/config.js';
import { writeSecret } from '../src/secrets.js';
import { adoptTunnel, createManagedTunnel, expose } from '../src/resources.js';

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

async function fixture() {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), 'cfm-resource-'));
  const paths = appPaths({ XDG_CONFIG_HOME: path.join(root, 'config'), XDG_STATE_HOME: path.join(root, 'state') }, root);
  const apiTokenFile = path.join(paths.configRoot, 'secrets', 'accounts', 'company-a.api-token');
  const tunnelTokenFile = path.join(paths.configRoot, 'secrets', 'company-a.token');
  await writeSecret(apiTokenFile, 'api-secret');
  await writeSecret(tunnelTokenFile, 'existing-tunnel-token');
  await saveConfig({
    version: 2,
    accounts: {
      'company-a': {
        accountId: '0123456789abcdef0123456789abcdef',
        apiTokenFile,
        defaultZoneId: null,
      },
    },
    tunnels: {
      'company-a': {
        managementMode: 'token-only',
        account: null,
        tunnelId: null,
        remoteName: null,
        tokenFile: tunnelTokenFile,
      },
    },
  }, paths);
  return { paths, tunnelTokenFile };
}

test('account alias can coexist with an existing token-only profile and be adopted', async () => {
  const { paths, tunnelTokenFile } = await fixture();
  const fetchImpl = async (url) => {
    assert.match(url, /cfd_tunnel\/11111111-1111-1111-1111-111111111111$/);
    return jsonResponse({ success: true, result: { id: '11111111-1111-1111-1111-111111111111', name: 'company-a' } });
  };
  const adopted = await adoptTunnel('company-a', 'company-a', {
    tunnelId: '11111111-1111-1111-1111-111111111111',
    fetchImpl,
    paths,
  });
  assert.equal(adopted.managementMode, 'adopted');
  assert.equal(adopted.account, 'company-a');
  assert.equal(adopted.tokenFile, tunnelTokenFile);
  assert.equal((await fsp.readFile(tunnelTokenFile, 'utf8')).trim(), 'existing-tunnel-token');
});

test('create refuses to duplicate an existing local profile before calling Cloudflare', async () => {
  const { paths } = await fixture();
  let called = false;
  await assert.rejects(
    () => createManagedTunnel('company-a', 'company-a', { fetchImpl: async () => { called = true; }, paths }),
    /already exists locally/,
  );
  assert.equal(called, false);
});

test('expose refuses token-only profile until explicit adoption', async () => {
  const { paths } = await fixture();
  await assert.rejects(
    () => expose('company-a', {
      name: 'company-a',
      hostname: 'webhook.example.com',
      port: '3001',
      manageDns: false,
      start: false,
      fetchImpl: async () => { throw new Error('should not call network'); },
      paths,
    }),
    /token-only/,
  );
});
