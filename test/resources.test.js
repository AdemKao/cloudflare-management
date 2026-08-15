import test from 'node:test';
import assert from 'node:assert/strict';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { appPaths, saveConfig } from '../src/config.js';
import { writeSecret } from '../src/secrets.js';
import { addRoute, adoptTunnel, createManagedTunnel, expose } from '../src/resources.js';

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

async function fixture() {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), 'cfm-resource-'));
  const paths = appPaths({ XDG_CONFIG_HOME: path.join(root, 'config'), XDG_STATE_HOME: path.join(root, 'state') }, root);
  const apiTokenFile = path.join(paths.configRoot, 'secrets', 'accounts', 'company-a.api-token');
  const tunnelTokenFile = path.join(paths.configRoot, 'secrets', 'company-a.token');
  const managedTokenFile = path.join(paths.configRoot, 'secrets', 'tunnels', 'project-dev.token');
  await writeSecret(apiTokenFile, 'api-secret');
  await writeSecret(tunnelTokenFile, 'existing-tunnel-token');
  await writeSecret(managedTokenFile, 'managed-tunnel-token');
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
      'project-dev': {
        managementMode: 'adopted',
        account: 'company-a',
        tunnelId: '11111111-1111-1111-1111-111111111111',
        remoteName: 'project-dev',
        tokenFile: managedTokenFile,
      },
    },
  }, paths);
  return { paths, tunnelTokenFile };
}

test('account alias can coexist with an existing token-only profile and be adopted', async () => {
  const { paths, tunnelTokenFile } = await fixture();
  const fetchImpl = async (url) => {
    assert.match(url, /cfd_tunnel\/22222222-2222-2222-2222-222222222222$/);
    return jsonResponse({ success: true, result: { id: '22222222-2222-2222-2222-222222222222', name: 'company-a' } });
  };
  const adopted = await adoptTunnel('company-a', 'company-a', {
    tunnelId: '22222222-2222-2222-2222-222222222222',
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

test('route add auto-discovers the parent Cloudflare zone when --dns has no Zone ID', async () => {
  const { paths } = await fixture();
  const zoneId = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    const parsed = new URL(url);
    const method = options.method ?? 'GET';
    calls.push({ method, url: parsed.toString(), body: options.body ? JSON.parse(options.body) : null });

    if (parsed.pathname === '/client/v4/zones') {
      const name = parsed.searchParams.get('name');
      if (name === 'webhook.example.com') return jsonResponse({ success: true, result: [] });
      if (name === 'example.com') {
        return jsonResponse({
          success: true,
          result: [{
            id: zoneId,
            name: 'example.com',
            account: { id: '0123456789abcdef0123456789abcdef' },
          }],
        });
      }
      return jsonResponse({ success: true, result: [] });
    }

    if (parsed.pathname.endsWith('/configurations') && method === 'GET') {
      return jsonResponse({ success: true, result: { config: { ingress: [{ service: 'http_status:404' }] } } });
    }
    if (parsed.pathname.endsWith('/configurations') && method === 'PUT') {
      const body = JSON.parse(options.body);
      assert.deepEqual(body.config.ingress, [
        { hostname: 'webhook.example.com', service: 'http://localhost:3001' },
        { service: 'http_status:404' },
      ]);
      return jsonResponse({ success: true, result: body });
    }
    if (parsed.pathname === `/client/v4/zones/${zoneId}/dns_records` && method === 'GET') {
      assert.equal(parsed.searchParams.get('name'), 'webhook.example.com');
      assert.equal(parsed.searchParams.get('type'), 'CNAME');
      return jsonResponse({ success: true, result: [] });
    }
    if (parsed.pathname === `/client/v4/zones/${zoneId}/dns_records` && method === 'POST') {
      const body = JSON.parse(options.body);
      assert.equal(body.name, 'webhook.example.com');
      assert.equal(body.content, '11111111-1111-1111-1111-111111111111.cfargotunnel.com');
      assert.equal(body.proxied, true);
      return jsonResponse({ success: true, result: { id: 'dns-record-id', ...body } });
    }
    throw new Error(`Unexpected request: ${method} ${parsed}`);
  };

  const result = await addRoute('company-a', 'project-dev', {
    hostname: 'webhook.example.com',
    origin: 'http://localhost:3001',
    manageDns: true,
    fetchImpl,
    paths,
  });

  assert.equal(result.dnsManaged, true);
  assert.equal(result.zoneId, zoneId);
  assert.equal(result.zoneName, 'example.com');
  assert.equal(result.zoneSource, 'discovered');
  assert.equal(calls.filter((call) => new URL(call.url).pathname === '/client/v4/zones').length, 2);
});

test('route add gives actionable guidance when automatic zone discovery lacks Zone Read', async () => {
  const { paths } = await fixture();
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    const parsed = new URL(url);
    calls.push({ method: options.method ?? 'GET', pathname: parsed.pathname });
    if (parsed.pathname === '/client/v4/zones') {
      return jsonResponse({ success: false, errors: [{ code: 9109, message: 'Forbidden' }] }, 403);
    }
    throw new Error(`Unexpected request: ${parsed}`);
  };

  await assert.rejects(
    () => addRoute('company-a', 'project-dev', {
      hostname: 'webhook.example.com',
      origin: 'http://localhost:3001',
      manageDns: true,
      fetchImpl,
      paths,
    }),
    (error) => {
      assert.match(error.message, /Zone:Zone:Read/);
      assert.match(error.message, /--zone-id <ZONE_ID>/);
      return true;
    },
  );

  assert.deepEqual(calls, [{ method: 'GET', pathname: '/client/v4/zones' }]);
});
