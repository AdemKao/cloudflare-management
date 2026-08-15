import test from 'node:test';
import assert from 'node:assert/strict';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { accountApiTokenPath, accountTunnelTokenPath, appPaths, legacyTunnelTokenPath, saveConfig } from '../src/config.js';
import { writeSecret } from '../src/secrets.js';
import { addRoute, adoptTunnel, createManagedTunnel, doctorAccount, expose } from '../src/resources.js';

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

async function fixture() {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), 'cfm-resource-'));
  const paths = appPaths({ XDG_CONFIG_HOME: path.join(root, 'config'), XDG_STATE_HOME: path.join(root, 'state') }, root);
  const apiTokenFile = accountApiTokenPath('company-a', paths);
  const tunnelTokenFile = legacyTunnelTokenPath('company-a', paths);
  const managedTokenFile = accountTunnelTokenPath('company-a', 'project-dev', paths);
  await writeSecret(apiTokenFile, 'api-secret');
  await writeSecret(tunnelTokenFile, 'existing-tunnel-token');
  await writeSecret(managedTokenFile, 'managed-tunnel-token');
  await saveConfig({
    version: 3,
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

test('account alias can coexist with a token-only profile and adoption relocates its token into the account boundary', async () => {
  const { paths, tunnelTokenFile } = await fixture();
  const target = accountTunnelTokenPath('company-a', 'company-a', paths);
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
  assert.equal(adopted.tokenFile, target);
  assert.equal((await fsp.readFile(target, 'utf8')).trim(), 'existing-tunnel-token');
  await assert.rejects(() => fsp.access(tunnelTokenFile), /ENOENT/);
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
      assert.match(error.message, /Zone -> Zone -> Read/);
      assert.match(error.message, /--zone-id <ZONE_ID>/);
      return true;
    },
  );

  assert.deepEqual(calls, [{ method: 'GET', pathname: '/client/v4/zones' }]);
});

test('route add recognizes Cloudflare code 10000 even when HTTP status is 200', async () => {
  const { paths } = await fixture();
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    const parsed = new URL(url);
    calls.push({ method: options.method ?? 'GET', pathname: parsed.pathname });
    if (parsed.pathname === '/client/v4/zones') {
      return jsonResponse({ success: false, errors: [{ code: 10000, message: 'Authentication error' }] }, 200);
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
      assert.match(error.message, /Zone -> Zone -> Read/);
      assert.match(error.message, /code 10000/);
      assert.match(error.message, /Authentication error/);
      return true;
    },
  );

  assert.deepEqual(calls, [{ method: 'GET', pathname: '/client/v4/zones' }]);
});

test('route add reports DNS authorization separately from Tunnel API access', async () => {
  const { paths } = await fixture();
  const zoneId = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
  const fetchImpl = async (url, options = {}) => {
    const parsed = new URL(url);
    const method = options.method ?? 'GET';
    if (parsed.pathname === '/client/v4/zones') {
      return jsonResponse({
        success: true,
        result: [{ id: zoneId, name: 'example.com', account: { id: '0123456789abcdef0123456789abcdef' } }],
      });
    }
    if (parsed.pathname.endsWith('/configurations') && method === 'GET') {
      return jsonResponse({ success: true, result: { config: { ingress: [{ service: 'http_status:404' }] } } });
    }
    if (parsed.pathname.endsWith('/configurations') && method === 'PUT') {
      return jsonResponse({ success: true, result: {} });
    }
    if (parsed.pathname === `/client/v4/zones/${zoneId}/dns_records`) {
      return jsonResponse({ success: false, errors: [{ code: 10000, message: 'Authentication error' }] }, 200);
    }
    throw new Error(`Unexpected request: ${method} ${parsed}`);
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
      assert.match(error.message, /DNS record management authorization failed/);
      assert.match(error.message, /Zone -> DNS -> Edit/);
      assert.match(error.message, /Zone Resources/);
      assert.match(error.message, /code 10000/);
      return true;
    },
  );
});

test('account doctor without hostname clearly checks Tunnel API only', async () => {
  const { paths } = await fixture();
  let calls = 0;
  const result = await doctorAccount('company-a', {
    paths,
    fetchImpl: async (url) => {
      calls += 1;
      assert.match(url, /cfd_tunnel/);
      return jsonResponse({ success: true, result: [] });
    },
  });
  assert.equal(result.tunnelApi, true);
  assert.equal(result.zoneChecked, false);
  assert.equal(result.dnsRead, null);
  assert.equal(calls, 1);
});

test('account doctor can validate Zone discovery and DNS read for a hostname', async () => {
  const { paths } = await fixture();
  const zoneId = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
  const result = await doctorAccount('company-a', {
    hostname: 'webhook.example.com',
    paths,
    fetchImpl: async (url) => {
      const parsed = new URL(url);
      if (parsed.pathname.includes('/cfd_tunnel')) return jsonResponse({ success: true, result: [] });
      if (parsed.pathname === '/client/v4/zones') {
        const name = parsed.searchParams.get('name');
        if (name === 'webhook.example.com') return jsonResponse({ success: true, result: [] });
        return jsonResponse({ success: true, result: [{ id: zoneId, name: 'example.com', account: { id: '0123456789abcdef0123456789abcdef' } }] });
      }
      if (parsed.pathname === `/client/v4/zones/${zoneId}/dns_records`) return jsonResponse({ success: true, result: [] });
      throw new Error(`Unexpected request: ${parsed}`);
    },
  });
  assert.equal(result.tunnelApi, true);
  assert.equal(result.zoneChecked, true);
  assert.equal(result.dnsRead, true);
  assert.equal(result.zoneName, 'example.com');
});
