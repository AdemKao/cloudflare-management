import test from 'node:test';
import assert from 'node:assert/strict';
import { CloudflareApiError, CloudflareClient, formatCloudflareError } from '../src/cloudflare/client.js';

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

test('Cloudflare client sends bearer token without exposing it in result', async () => {
  let seen;
  const client = new CloudflareClient({
    accountId: '0123456789abcdef0123456789abcdef',
    apiToken: 'super-secret-token',
    fetchImpl: async (url, options) => {
      seen = { url, options };
      return jsonResponse({ success: true, result: [] });
    },
  });
  await client.listTunnels();
  assert.match(seen.url, /cfd_tunnel/);
  assert.equal(seen.options.headers.Authorization, 'Bearer super-secret-token');
});

test('Cloudflare API failures preserve status but do not leak token', async () => {
  for (const status of [401, 403, 404, 409, 429, 500]) {
    const client = new CloudflareClient({
      accountId: '0123456789abcdef0123456789abcdef',
      apiToken: 'never-print-me',
      fetchImpl: async () => jsonResponse({ success: false, errors: [{ code: 1000, message: `failure-${status}` }] }, status),
    });
    await assert.rejects(
      () => client.listTunnels(),
      (error) => {
        assert.ok(error instanceof CloudflareApiError);
        assert.equal(error.status, status);
        assert.doesNotMatch(error.message, /never-print-me/);
        return true;
      },
    );
  }
});

test('Cloudflare success=false preserves code 10000 even when HTTP status is 200', async () => {
  const client = new CloudflareClient({
    accountId: '0123456789abcdef0123456789abcdef',
    apiToken: 'never-print-me',
    fetchImpl: async () => jsonResponse({ success: false, errors: [{ code: 10000, message: 'Authentication error' }] }, 200),
  });
  await assert.rejects(
    () => client.listZones({ name: 'example.com' }),
    (error) => {
      assert.ok(error instanceof CloudflareApiError);
      assert.equal(error.status, 200);
      assert.equal(error.code, 10000);
      assert.match(formatCloudflareError(error), /authentication\/authorization failed/);
      assert.match(formatCloudflareError(error), /code 10000/);
      assert.doesNotMatch(formatCloudflareError(error), /never-print-me/);
      return true;
    },
  );
});

test('createTunnel uses remotely-managed config source', async () => {
  let body;
  const client = new CloudflareClient({
    accountId: '0123456789abcdef0123456789abcdef',
    apiToken: 'x',
    fetchImpl: async (_url, options) => {
      body = JSON.parse(options.body);
      return jsonResponse({ success: true, result: { id: '11111111-1111-1111-1111-111111111111', name: body.name } });
    },
  });
  await client.createTunnel('project-dev');
  assert.deepEqual(body, { name: 'project-dev', config_src: 'cloudflare' });
});

test('listZones searches by name and keeps zones from the configured account', async () => {
  const accountId = '0123456789abcdef0123456789abcdef';
  let seenUrl;
  const client = new CloudflareClient({
    accountId,
    apiToken: 'x',
    fetchImpl: async (url) => {
      seenUrl = url;
      return jsonResponse({
        success: true,
        result: [
          { id: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', name: 'example.com', account: { id: accountId } },
          { id: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', name: 'example.com', account: { id: 'ffffffffffffffffffffffffffffffff' } },
        ],
      });
    },
  });

  const zones = await client.listZones({ name: 'example.com' });
  const parsed = new URL(seenUrl);
  assert.equal(parsed.pathname, '/client/v4/zones');
  assert.equal(parsed.searchParams.get('name'), 'example.com');
  assert.equal(parsed.searchParams.get('per_page'), '50');
  assert.deepEqual(zones.map((zone) => zone.id), ['aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa']);
});
