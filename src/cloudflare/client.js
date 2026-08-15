const DEFAULT_BASE_URL = 'https://api.cloudflare.com/client/v4';

export class CloudflareApiError extends Error {
  constructor(message, { status = null, code = null } = {}) {
    super(message);
    this.name = 'CloudflareApiError';
    this.status = status;
    this.code = code;
  }
}

function summarizeErrors(payload, fallback) {
  const items = Array.isArray(payload?.errors) ? payload.errors : [];
  const messages = items.map((item) => item?.message).filter(Boolean);
  const code = items.find((item) => item?.code != null)?.code ?? null;
  return { message: messages.join('; ') || fallback, code };
}

export class CloudflareClient {
  constructor({ accountId, apiToken, fetchImpl = globalThis.fetch, baseUrl = DEFAULT_BASE_URL, timeoutMs = 15000 }) {
    if (!accountId) throw new Error('Cloudflare Account ID is required.');
    if (!apiToken) throw new Error('Cloudflare API Token is required.');
    if (typeof fetchImpl !== 'function') throw new Error('A fetch implementation is required.');
    this.accountId = accountId;
    this.apiToken = apiToken;
    this.fetchImpl = fetchImpl;
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.timeoutMs = timeoutMs;
  }

  async request(method, pathname, body = undefined) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(`${this.baseUrl}${pathname}`, {
        method,
        headers: {
          Authorization: `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json',
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });

      let payload = null;
      const text = await response.text();
      if (text) {
        try {
          payload = JSON.parse(text);
        } catch {
          throw new CloudflareApiError(`Cloudflare returned invalid JSON (HTTP ${response.status}).`, { status: response.status });
        }
      }

      if (!response.ok || payload?.success === false) {
        const summary = summarizeErrors(payload, `Cloudflare API request failed with HTTP ${response.status}.`);
        throw new CloudflareApiError(summary.message, { status: response.status, code: summary.code });
      }
      return payload?.result ?? payload;
    } catch (error) {
      if (error?.name === 'AbortError') {
        throw new CloudflareApiError(`Cloudflare API request timed out after ${this.timeoutMs}ms.`);
      }
      if (error instanceof CloudflareApiError) throw error;
      throw new CloudflareApiError(`Cloudflare API request failed: ${error.message}`);
    } finally {
      clearTimeout(timeout);
    }
  }

  async verifyAccount() {
    await this.listTunnels({ perPage: 1 });
    return true;
  }

  async listTunnels({ perPage = 100 } = {}) {
    return this.request('GET', `/accounts/${this.accountId}/cfd_tunnel?is_deleted=false&per_page=${perPage}`);
  }

  async createTunnel(name) {
    return this.request('POST', `/accounts/${this.accountId}/cfd_tunnel`, {
      name,
      config_src: 'cloudflare',
    });
  }

  async getTunnel(tunnelId) {
    return this.request('GET', `/accounts/${this.accountId}/cfd_tunnel/${encodeURIComponent(tunnelId)}`);
  }

  async deleteTunnel(tunnelId) {
    return this.request('DELETE', `/accounts/${this.accountId}/cfd_tunnel/${encodeURIComponent(tunnelId)}`);
  }

  async getTunnelToken(tunnelId) {
    return this.request('GET', `/accounts/${this.accountId}/cfd_tunnel/${encodeURIComponent(tunnelId)}/token`);
  }

  async getTunnelConfig(tunnelId) {
    return this.request('GET', `/accounts/${this.accountId}/cfd_tunnel/${encodeURIComponent(tunnelId)}/configurations`);
  }

  async putTunnelConfig(tunnelId, config) {
    return this.request('PUT', `/accounts/${this.accountId}/cfd_tunnel/${encodeURIComponent(tunnelId)}/configurations`, { config });
  }

  async listZones({ name, perPage = 50 } = {}) {
    const params = new URLSearchParams();
    if (name) params.set('name', name);
    const normalizedPerPage = Math.min(50, Math.max(5, Number(perPage) || 50));
    params.set('per_page', String(normalizedPerPage));
    const zones = await this.request('GET', `/zones?${params.toString()}`);
    if (!Array.isArray(zones)) return [];
    return zones.filter((zone) => !zone?.account?.id || zone.account.id === this.accountId);
  }

  async listDnsRecords(zoneId, { name, type } = {}) {
    const params = new URLSearchParams();
    if (name) params.set('name', name);
    if (type) params.set('type', type);
    const suffix = params.size ? `?${params.toString()}` : '';
    return this.request('GET', `/zones/${encodeURIComponent(zoneId)}/dns_records${suffix}`);
  }

  async upsertTunnelDns(zoneId, hostname, tunnelId) {
    const records = await this.listDnsRecords(zoneId, { name: hostname, type: 'CNAME' });
    const body = {
      type: 'CNAME',
      name: hostname,
      content: `${tunnelId}.cfargotunnel.com`,
      proxied: true,
      ttl: 1,
    };
    const existing = Array.isArray(records) ? records[0] : null;
    if (existing?.id) {
      return this.request('PUT', `/zones/${encodeURIComponent(zoneId)}/dns_records/${encodeURIComponent(existing.id)}`, body);
    }
    return this.request('POST', `/zones/${encodeURIComponent(zoneId)}/dns_records`, body);
  }

  async deleteDnsByHostname(zoneId, hostname) {
    const records = await this.listDnsRecords(zoneId, { name: hostname });
    for (const record of Array.isArray(records) ? records : []) {
      await this.request('DELETE', `/zones/${encodeURIComponent(zoneId)}/dns_records/${encodeURIComponent(record.id)}`);
    }
  }
}

export function formatCloudflareError(error) {
  if (!(error instanceof CloudflareApiError)) return error.message;
  if (Number(error.code) === 10000) return `Cloudflare authentication/authorization failed (code 10000): ${error.message}`;
  if (error.status === 401) return `Cloudflare authentication failed (401): ${error.message}`;
  if (error.status === 403) return `Cloudflare permission denied (403): ${error.message}`;
  if (error.status === 404) return `Cloudflare resource not found (404): ${error.message}`;
  if (error.status === 409) return `Cloudflare resource conflict (409): ${error.message}`;
  if (error.status === 429) return `Cloudflare rate limit reached (429): ${error.message}`;
  if (error.status && error.status >= 500) return `Cloudflare service error (${error.status}): ${error.message}`;
  if (error.code != null) return `Cloudflare API error (code ${error.code}): ${error.message}`;
  return error.message;
}
