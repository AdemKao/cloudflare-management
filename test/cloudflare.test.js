import test from 'node:test';
import assert from 'node:assert/strict';
import { CloudflareApiError, CloudflareClient } from '../src/cloudflare/client.js';

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
  await client.createTunnel('solana-dev');
  assert.deepEqual(body, { name: 'solana-dev', config_src: 'cloudflare' });
});
