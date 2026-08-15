import fsp from 'node:fs/promises';
import { appPaths, loadConfig, saveConfig } from './config.js';
import { accountTokenPath, readSecret, tunnelTokenPath, writeSecret } from './secrets.js';
import { CloudflareClient } from './cloudflare/client.js';
import { validateAccountId, validateHostname, validateName, validateOrigin, validateTunnelId, validateZoneId } from './validation.js';

async function clientForAccount(config, accountAlias, { fetchImpl = globalThis.fetch } = {}) {
  const account = config.accounts[accountAlias];
  if (!account) throw new Error(`Unknown Cloudflare account alias: ${accountAlias}`);
  const apiToken = await readSecret(account.apiTokenFile);
  return new CloudflareClient({ accountId: account.accountId, apiToken, fetchImpl });
}

function isCloudflareAuthzError(error) {
  return [401, 403].includes(error?.status)
    || [10000, 9109].includes(Number(error?.code))
    || /authentication|permission|forbidden|not authorized/i.test(error?.message ?? '');
}

function cloudflareErrorDetail(error) {
  const parts = [];
  if (error?.status && error.status !== 200) parts.push(`HTTP ${error.status}`);
  if (error?.code != null) parts.push(`code ${error.code}`);
  if (error?.message) parts.push(error.message);
  return parts.length ? ` Cloudflare response: ${parts.join(', ')}.` : '';
}

function zoneLabel(zone, hostname) {
  return zone?.zoneName || zone?.zoneId || hostname;
}

function dnsAuthorizationError(action, hostname, zone, error) {
  return new Error(
    `Cloudflare ${action} authorization failed for "${hostname}" in Zone "${zoneLabel(zone, hostname)}". `
    + 'The Account API Token can still be valid for Tunnel operations while lacking Zone/DNS access. '
    + 'Grant Zone -> DNS -> Edit for the target Zone and ensure Zone Resources includes that Zone. '
    + 'If automatic Zone discovery is used, also grant Zone -> Zone -> Read, or pass --zone-id <ZONE_ID> explicitly.'
    + cloudflareErrorDetail(error),
  );
}

export async function addAccount(alias, { accountId, apiToken, zoneId = null, fetchImpl = globalThis.fetch, paths = appPaths(), force = false } = {}) {
  validateName(alias);
  validateAccountId(accountId);
  if (zoneId) validateZoneId(zoneId);
  if (!apiToken) throw new Error('Cloudflare API Token is required.');
  const config = await loadConfig({ paths });
  const previous = config.accounts[alias] ?? null;
  if (previous && !force) throw new Error(`Account alias "${alias}" already exists. Use --force to replace it.`);

  const client = new CloudflareClient({ accountId, apiToken, fetchImpl });
  await client.verifyAccount();

  const tokenFile = accountTokenPath(alias, paths);
  let previousToken = null;
  if (previous?.apiTokenFile) {
    try { previousToken = await readSecret(previous.apiTokenFile); } catch { previousToken = null; }
  }

  await writeSecret(tokenFile, apiToken);
  const now = new Date().toISOString();
  config.accounts[alias] = {
    accountId,
    apiTokenFile: tokenFile,
    defaultZoneId: zoneId || null,
    createdAt: previous?.createdAt ?? now,
    updatedAt: now,
  };
  try {
    await saveConfig(config, paths);
  } catch (error) {
    if (previousToken != null) await writeSecret(tokenFile, previousToken).catch(() => {});
    else await fsp.rm(tokenFile, { force: true }).catch(() => {});
    throw error;
  }
  return config.accounts[alias];
}

export async function listAccounts(paths = appPaths()) {
  const config = await loadConfig({ paths });
  return Object.entries(config.accounts).sort(([a], [b]) => a.localeCompare(b)).map(([name, value]) => ({ name, ...value }));
}

export async function showAccount(alias, paths = appPaths()) {
  validateName(alias);
  const config = await loadConfig({ paths });
  const account = config.accounts[alias];
  if (!account) throw new Error(`Unknown Cloudflare account alias: ${alias}`);
  return { name: alias, accountId: account.accountId, defaultZoneId: account.defaultZoneId ?? null, apiTokenFile: account.apiTokenFile };
}

export async function doctorAccount(alias, { hostname = null, zoneId = null, fetchImpl = globalThis.fetch, paths = appPaths() } = {}) {
  const config = await loadConfig({ paths });
  const account = config.accounts[alias];
  if (!account) throw new Error(`Unknown Cloudflare account alias: ${alias}`);
  const client = await clientForAccount(config, alias, { fetchImpl });
  await client.verifyAccount();

  const result = {
    tunnelApi: true,
    zoneChecked: false,
    dnsRead: null,
    zoneId: null,
    zoneName: null,
    zoneSource: null,
  };

  if (!hostname) return result;
  hostname = validateHostname(hostname);
  const dnsZone = await resolveDnsZone(client, account, hostname, zoneId);
  result.zoneChecked = true;
  result.zoneId = dnsZone.zoneId;
  result.zoneName = dnsZone.zoneName;
  result.zoneSource = dnsZone.source;
  try {
    await client.listDnsRecords(dnsZone.zoneId, { name: hostname });
    result.dnsRead = true;
  } catch (error) {
    if (isCloudflareAuthzError(error)) {
      throw new Error(
        `Cloudflare DNS access check failed for "${hostname}" in Zone "${zoneLabel(dnsZone, hostname)}". `
        + 'Tunnel API access is valid, but this token cannot read DNS records for the target Zone. '
        + 'Grant Zone -> DNS -> Read/Edit for that Zone and verify Zone Resources includes it.'
        + cloudflareErrorDetail(error),
      );
    }
    throw error;
  }
  return result;
}

export async function removeAccount(alias, { paths = appPaths(), keepToken = false } = {}) {
  const config = await loadConfig({ paths });
  const account = config.accounts[alias];
  if (!account) throw new Error(`Unknown Cloudflare account alias: ${alias}`);
  const linked = Object.entries(config.tunnels).filter(([, tunnel]) => tunnel.account === alias);
  if (linked.length) throw new Error(`Account "${alias}" is still referenced by tunnel profile(s): ${linked.map(([name]) => name).join(', ')}`);
  delete config.accounts[alias];
  await saveConfig(config, paths);
  if (!keepToken) await fsp.rm(account.apiTokenFile, { force: true });
}

export async function listRemoteTunnels(accountAlias, { fetchImpl = globalThis.fetch, paths = appPaths() } = {}) {
  const config = await loadConfig({ paths });
  const client = await clientForAccount(config, accountAlias, { fetchImpl });
  const result = await client.listTunnels();
  return Array.isArray(result) ? result : [];
}

export async function createManagedTunnel(accountAlias, name, { fetchImpl = globalThis.fetch, paths = appPaths() } = {}) {
  validateName(name);
  const config = await loadConfig({ paths });
  if (config.tunnels[name]) {
    throw new Error(`Tunnel/profile "${name}" already exists locally. Use cfm tunnel adopt for an existing manual Tunnel instead of creating a duplicate.`);
  }
  const client = await clientForAccount(config, accountAlias, { fetchImpl });
  const created = await client.createTunnel(name);
  const tunnelId = validateTunnelId(created?.id);
  let token;
  try {
    token = await client.getTunnelToken(tunnelId);
    if (typeof token !== 'string') throw new Error('Cloudflare did not return a Tunnel Token string.');
  } catch (error) {
    await client.deleteTunnel(tunnelId).catch(() => {});
    throw error;
  }
  const tokenFile = tunnelTokenPath(name, paths);
  try {
    await writeSecret(tokenFile, token);
    const now = new Date().toISOString();
    config.tunnels[name] = {
      managementMode: 'provisioned',
      account: accountAlias,
      tunnelId,
      remoteName: created?.name ?? name,
      tokenFile,
      createdAt: now,
      updatedAt: now,
    };
    await saveConfig(config, paths);
    return { name, ...config.tunnels[name] };
  } catch (error) {
    await fsp.rm(tokenFile, { force: true }).catch(() => {});
    await client.deleteTunnel(tunnelId).catch(() => {});
    throw error;
  }
}

export async function adoptTunnel(accountAlias, profileName, { tunnelId = null, fetchImpl = globalThis.fetch, paths = appPaths() } = {}) {
  validateName(profileName);
  const config = await loadConfig({ paths });
  const profile = config.tunnels[profileName];
  if (!profile) throw new Error(`Unknown local tunnel profile: ${profileName}`);
  if (profile.managementMode === 'provisioned') throw new Error(`Tunnel/profile "${profileName}" is already provisioned by cfm.`);
  const client = await clientForAccount(config, accountAlias, { fetchImpl });

  let remote;
  if (tunnelId) {
    validateTunnelId(tunnelId);
    remote = await client.getTunnel(tunnelId);
  } else {
    const tunnels = await client.listTunnels();
    const matches = (Array.isArray(tunnels) ? tunnels : []).filter((item) => item?.name === profileName || item?.name === profile.remoteName);
    if (matches.length !== 1) {
      const candidates = (Array.isArray(tunnels) ? tunnels : []).map((item) => `${item.name} (${item.id})`).join(', ');
      throw new Error(`Could not uniquely resolve a remote Tunnel for "${profileName}". Re-run with --tunnel-id <id>. Available: ${candidates || 'none'}`);
    }
    [remote] = matches;
  }

  const remoteId = validateTunnelId(remote.id);
  const duplicate = Object.entries(config.tunnels).find(([name, tunnel]) => name !== profileName && tunnel.account === accountAlias && tunnel.tunnelId === remoteId);
  if (duplicate) throw new Error(`Remote Tunnel ${remoteId} is already attached to local profile "${duplicate[0]}".`);

  profile.managementMode = 'adopted';
  profile.account = accountAlias;
  profile.tunnelId = remoteId;
  profile.remoteName = remote.name ?? profileName;
  profile.updatedAt = new Date().toISOString();
  await saveConfig(config, paths);
  return { name: profileName, ...profile };
}

export async function resolveManagedTunnel(config, accountAlias, name) {
  const profile = config.tunnels[name];
  if (!profile) throw new Error(`Unknown local tunnel profile: ${name}`);
  if (!['adopted', 'provisioned'].includes(profile.managementMode)) {
    throw new Error(`Tunnel/profile "${name}" is token-only. Run cfm tunnel adopt ${accountAlias} ${name} before API management.`);
  }
  if (profile.account !== accountAlias) throw new Error(`Tunnel/profile "${name}" belongs to account alias "${profile.account}", not "${accountAlias}".`);
  if (!profile.tunnelId) throw new Error(`Tunnel/profile "${name}" has no remote Tunnel ID.`);
  return profile;
}

export async function showManagedTunnel(accountAlias, name, { fetchImpl = globalThis.fetch, paths = appPaths() } = {}) {
  const config = await loadConfig({ paths });
  const profile = await resolveManagedTunnel(config, accountAlias, name);
  const client = await clientForAccount(config, accountAlias, { fetchImpl });
  const remote = await client.getTunnel(profile.tunnelId);
  return { profile: { name, ...profile }, remote };
}

export async function refreshTunnelToken(accountAlias, name, { fetchImpl = globalThis.fetch, paths = appPaths() } = {}) {
  const config = await loadConfig({ paths });
  const profile = await resolveManagedTunnel(config, accountAlias, name);
  const client = await clientForAccount(config, accountAlias, { fetchImpl });
  const token = await client.getTunnelToken(profile.tunnelId);
  if (typeof token !== 'string') throw new Error('Cloudflare did not return a Tunnel Token string.');
  await writeSecret(profile.tokenFile, token);
  profile.updatedAt = new Date().toISOString();
  await saveConfig(config, paths);
  return profile.tokenFile;
}

export async function deleteManagedTunnel(accountAlias, name, { fetchImpl = globalThis.fetch, paths = appPaths(), deleteLocal = true } = {}) {
  const config = await loadConfig({ paths });
  const profile = await resolveManagedTunnel(config, accountAlias, name);
  const client = await clientForAccount(config, accountAlias, { fetchImpl });
  await client.deleteTunnel(profile.tunnelId);
  if (deleteLocal) {
    delete config.tunnels[name];
    await saveConfig(config, paths);
    await fsp.rm(profile.tokenFile, { force: true });
  }
}

function normalizeIngress(configResult) {
  const config = configResult?.config ?? configResult ?? {};
  const ingress = Array.isArray(config.ingress) ? [...config.ingress] : [];
  const catchAll = ingress.find((rule) => !rule.hostname) ?? { service: 'http_status:404' };
  return { config: { ...config, ingress: ingress.filter((rule) => rule.hostname) }, catchAll };
}

function hostnameZoneCandidates(hostname) {
  const host = hostname.startsWith('*.') ? hostname.slice(2) : hostname;
  const labels = host.split('.').filter(Boolean);
  const candidates = [];
  for (let index = 0; index <= labels.length - 2; index += 1) {
    candidates.push(labels.slice(index).join('.'));
  }
  return candidates;
}

async function resolveDnsZone(client, account, hostname, requestedZoneId = null) {
  if (requestedZoneId) {
    return { zoneId: validateZoneId(requestedZoneId), zoneName: null, source: 'explicit' };
  }
  if (account.defaultZoneId) {
    return { zoneId: validateZoneId(account.defaultZoneId), zoneName: null, source: 'account-default' };
  }

  for (const candidate of hostnameZoneCandidates(hostname)) {
    let zones;
    try {
      zones = await client.listZones({ name: candidate });
    } catch (error) {
      if (isCloudflareAuthzError(error)) {
        throw new Error(
          `Automatic Cloudflare Zone discovery failed for "${hostname}". `
          + 'The API Token is valid for Tunnel operations but does not have usable access to the target Zone. '
          + 'Grant Zone -> Zone -> Read for that Zone, or pass --zone-id <ZONE_ID> to skip discovery. '
          + 'If DNS records should be created or updated, also grant Zone -> DNS -> Edit.'
          + cloudflareErrorDetail(error),
        );
      }
      throw error;
    }

    const matches = (Array.isArray(zones) ? zones : []).filter((zone) => zone?.name?.toLowerCase() === candidate.toLowerCase());
    if (matches.length > 1) {
      throw new Error(`Multiple Cloudflare Zones matched "${candidate}". Pass --zone-id <ZONE_ID> explicitly.`);
    }
    if (matches.length === 1) {
      return {
        zoneId: validateZoneId(matches[0].id),
        zoneName: matches[0].name ?? candidate,
        source: 'discovered',
      };
    }
  }

  throw new Error(
    `Could not discover a Cloudflare Zone for "${hostname}". Pass --zone-id <ZONE_ID>, configure a default Zone ID on the account, `
    + 'or grant the API Token Zone -> Zone -> Read so cfm can resolve the hostname automatically.',
  );
}

export async function listRoutes(accountAlias, tunnelName, { fetchImpl = globalThis.fetch, paths = appPaths() } = {}) {
  const config = await loadConfig({ paths });
  const profile = await resolveManagedTunnel(config, accountAlias, tunnelName);
  const client = await clientForAccount(config, accountAlias, { fetchImpl });
  const current = await client.getTunnelConfig(profile.tunnelId);
  return normalizeIngress(current).config.ingress;
}

export async function addRoute(accountAlias, tunnelName, { hostname, origin, zoneId = null, manageDns = false, fetchImpl = globalThis.fetch, paths = appPaths() } = {}) {
  hostname = validateHostname(hostname);
  origin = validateOrigin(origin);
  const config = await loadConfig({ paths });
  const profile = await resolveManagedTunnel(config, accountAlias, tunnelName);
  const account = config.accounts[accountAlias];
  const client = await clientForAccount(config, accountAlias, { fetchImpl });
  const dnsZone = manageDns ? await resolveDnsZone(client, account, hostname, zoneId) : null;
  const current = await client.getTunnelConfig(profile.tunnelId).catch((error) => {
    if (error?.status === 404) return { config: { ingress: [] } };
    throw error;
  });
  const normalized = normalizeIngress(current);
  const nextRules = normalized.config.ingress.filter((rule) => rule.hostname !== hostname);
  nextRules.push({ hostname, service: origin });
  await client.putTunnelConfig(profile.tunnelId, { ...normalized.config, ingress: [...nextRules, normalized.catchAll] });
  if (manageDns) {
    try {
      await client.upsertTunnelDns(dnsZone.zoneId, hostname, profile.tunnelId);
    } catch (error) {
      if (isCloudflareAuthzError(error)) throw dnsAuthorizationError('DNS record management', hostname, dnsZone, error);
      throw error;
    }
  }
  return {
    hostname,
    origin,
    tunnelId: profile.tunnelId,
    dnsManaged: manageDns,
    zoneId: dnsZone?.zoneId ?? null,
    zoneName: dnsZone?.zoneName ?? null,
    zoneSource: dnsZone?.source ?? null,
  };
}

export async function removeRoute(accountAlias, tunnelName, { hostname, zoneId = null, manageDns = false, fetchImpl = globalThis.fetch, paths = appPaths() } = {}) {
  hostname = validateHostname(hostname);
  const config = await loadConfig({ paths });
  const profile = await resolveManagedTunnel(config, accountAlias, tunnelName);
  const account = config.accounts[accountAlias];
  const client = await clientForAccount(config, accountAlias, { fetchImpl });
  const dnsZone = manageDns ? await resolveDnsZone(client, account, hostname, zoneId) : null;
  const current = await client.getTunnelConfig(profile.tunnelId);
  const normalized = normalizeIngress(current);
  const nextRules = normalized.config.ingress.filter((rule) => rule.hostname !== hostname);
  await client.putTunnelConfig(profile.tunnelId, { ...normalized.config, ingress: [...nextRules, normalized.catchAll] });
  if (manageDns) {
    try {
      await client.deleteDnsByHostname(dnsZone.zoneId, hostname);
    } catch (error) {
      if (isCloudflareAuthzError(error)) throw dnsAuthorizationError('DNS record deletion', hostname, dnsZone, error);
      throw error;
    }
  }
  return {
    hostname,
    dnsManaged: manageDns,
    zoneId: dnsZone?.zoneId ?? null,
    zoneName: dnsZone?.zoneName ?? null,
    zoneSource: dnsZone?.source ?? null,
  };
}

export async function expose(accountAlias, { name, hostname, origin, port, zoneId = null, manageDns = true, start = true, fetchImpl = globalThis.fetch, paths = appPaths(), startTunnelFn = null } = {}) {
  validateName(name);
  hostname = validateHostname(hostname);
  if (!origin) {
    if (!port || !/^\d+$/.test(String(port)) || Number(port) < 1 || Number(port) > 65535) throw new Error('Expose requires --url <origin> or a valid --port <1-65535>.');
    origin = `http://localhost:${Number(port)}`;
  }
  origin = validateOrigin(origin);

  const initialConfig = await loadConfig({ paths });
  const existing = initialConfig.tunnels[name];
  let created = false;
  if (!existing) {
    await createManagedTunnel(accountAlias, name, { fetchImpl, paths });
    created = true;
  } else {
    await resolveManagedTunnel(initialConfig, accountAlias, name);
  }

  let routeResult;
  try {
    routeResult = await addRoute(accountAlias, name, { hostname, origin, zoneId, manageDns, fetchImpl, paths });
  } catch (error) {
    if (created) await deleteManagedTunnel(accountAlias, name, { fetchImpl, paths }).catch(() => {});
    throw error;
  }

  if (start && startTunnelFn) await startTunnelFn(name, { paths });
  return {
    name,
    hostname,
    origin,
    created,
    started: Boolean(start && startTunnelFn),
    url: `https://${hostname}`,
    dnsManaged: routeResult.dnsManaged,
    zoneId: routeResult.zoneId,
    zoneName: routeResult.zoneName,
    zoneSource: routeResult.zoneSource,
  };
}
