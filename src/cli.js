import fsp from 'node:fs/promises';
import path from 'node:path';
import { appPaths, ensureDirectories, loadConfig, saveConfig } from './config.js';
import { resolveSecret, promptLine, writeSecret } from './secrets.js';
import { validateName } from './validation.js';
import { formatCloudflareError, CloudflareApiError } from './cloudflare/client.js';
import {
  addAccount,
  adoptTunnel,
  createManagedTunnel,
  deleteManagedTunnel,
  doctorAccount,
  expose,
  listAccounts,
  listRemoteTunnels,
  listRoutes,
  refreshTunnelToken,
  removeAccount,
  removeRoute,
  addRoute,
  showAccount,
  showManagedTunnel,
} from './resources.js';
import {
  doctor,
  printStatus,
  removeLocalTunnel,
  showLogs,
  startAll,
  startTunnel,
  stopAll,
  stopTunnel,
} from './process.js';

export { validateName } from './validation.js';

export function parseArgs(args) {
  const command = args[0] ?? 'help';
  const positionals = [];
  const options = {};
  for (let index = 1; index < args.length; index += 1) {
    const value = args[index];
    if (value.startsWith('--')) {
      const key = value.slice(2);
      const next = args[index + 1];
      if (next && !next.startsWith('--')) {
        options[key] = next;
        index += 1;
      } else {
        options[key] = true;
      }
      continue;
    }
    positionals.push(value);
  }
  return { command, positionals, options };
}

async function packageVersion() {
  const packageUrl = new URL('../package.json', import.meta.url);
  return JSON.parse(await fsp.readFile(packageUrl, 'utf8')).version;
}

async function addLegacyTunnel(name, options, paths = appPaths()) {
  validateName(name);
  const config = await loadConfig({ paths });
  if (config.tunnels[name] && !options.force) {
    throw new Error(`Tunnel profile "${name}" already exists. Use --force to replace it.`);
  }
  const token = await resolveSecret(options, 'Tunnel token: ');
  const tokenFile = path.join(paths.secretsRoot, `${name}.token`);
  await writeSecret(tokenFile, token);
  const now = new Date().toISOString();
  config.tunnels[name] = {
    managementMode: 'token-only',
    account: null,
    tunnelId: null,
    remoteName: null,
    tokenFile,
    createdAt: config.tunnels[name]?.createdAt ?? now,
    updatedAt: now,
  };
  await saveConfig(config, paths);
  console.log(`Added tunnel profile: ${name}`);
  console.log('Mode: token-only');
  console.log(`Token stored locally with mode 600: ${tokenFile}`);
}

async function listLocalTunnels(paths = appPaths()) {
  const config = await loadConfig({ paths });
  const names = Object.keys(config.tunnels).sort();
  if (!names.length) {
    console.log('No tunnel profiles configured.');
    return;
  }
  const width = Math.max(4, ...names.map((name) => name.length));
  console.log(`${'NAME'.padEnd(width)}  MODE         ACCOUNT`);
  for (const name of names) {
    const tunnel = config.tunnels[name];
    console.log(`${name.padEnd(width)}  ${(tunnel.managementMode ?? 'token-only').padEnd(12)} ${tunnel.account ?? '-'}`);
  }
}

async function confirmAction(message, options) {
  if (options.yes) return true;
  const answer = await promptLine(`${message} Type "yes" to continue: `);
  return answer.toLowerCase() === 'yes';
}

function requireValue(value, usage) {
  if (!value) throw new Error(`Missing required argument. Usage: ${usage}`);
  return value;
}

function printObject(value) {
  console.log(JSON.stringify(value, null, 2));
}

async function runAccount(positionals, options, paths) {
  const action = positionals[0];
  const alias = positionals[1];
  if (action === 'add') {
    requireValue(alias, 'cfm account add <name> [--account-id <id>] [--token-file <path>] [--zone-id <id>]');
    const accountId = options['account-id'] || await promptLine('Cloudflare Account ID: ');
    const apiToken = await resolveSecret(options, 'Cloudflare API Token: ');
    const account = await addAccount(alias, {
      accountId,
      apiToken,
      zoneId: options['zone-id'] || null,
      force: Boolean(options.force),
      paths,
    });
    console.log(`Added Cloudflare account: ${alias}`);
    console.log(`Account ID: ${account.accountId}`);
    if (account.defaultZoneId) console.log(`Default Zone ID: ${account.defaultZoneId}`);
    return;
  }
  if (action === 'list') {
    const accounts = await listAccounts(paths);
    if (!accounts.length) return console.log('No Cloudflare accounts configured.');
    for (const account of accounts) console.log(`${account.name}\t${account.accountId}\tzone=${account.defaultZoneId ?? '-'}`);
    return;
  }
  if (action === 'show') return printObject(await showAccount(requireValue(alias, 'cfm account show <name>'), paths));
  if (action === 'doctor') {
    requireValue(alias, 'cfm account doctor <name> [--hostname <hostname>] [--zone-id <id>]');
    const result = await doctorAccount(alias, {
      hostname: options.hostname || null,
      zoneId: options['zone-id'] || null,
      paths,
    });
    console.log(`${alias}: Tunnel API credential OK`);
    if (!result.zoneChecked) {
      console.log('Zone/DNS: not checked (pass --hostname <hostname> to validate DNS access)');
      return;
    }
    console.log(`Zone: ${result.zoneName ?? result.zoneId} (${result.zoneSource})`);
    console.log('DNS read: OK');
    console.log('DNS write: not mutated by doctor; route --dns still requires Zone -> DNS -> Edit');
    return;
  }
  if (action === 'remove') {
    requireValue(alias, 'cfm account remove <name> [--yes]');
    if (!await confirmAction(`Remove local Cloudflare account credential "${alias}"?`, options)) return console.log('Cancelled.');
    await removeAccount(alias, { paths });
    console.log(`Removed Cloudflare account: ${alias}`);
    return;
  }
  throw new Error('Usage: cfm account <add|list|show|doctor|remove> ...');
}

async function runTunnel(positionals, options, paths) {
  const action = positionals[0];
  const account = positionals[1];
  const name = positionals[2];
  if (action === 'list') {
    requireValue(account, 'cfm tunnel list <account>');
    const tunnels = await listRemoteTunnels(account, { paths });
    if (!tunnels.length) return console.log('No remotely-managed Tunnels found.');
    for (const tunnel of tunnels) console.log(`${tunnel.name}\t${tunnel.id}\t${tunnel.status ?? ''}`.trim());
    return;
  }
  if (action === 'create') {
    requireValue(account, 'cfm tunnel create <account> <name>');
    requireValue(name, 'cfm tunnel create <account> <name>');
    const created = await createManagedTunnel(account, name, { paths });
    console.log(`Created Tunnel: ${created.name}`);
    console.log(`Tunnel ID: ${created.tunnelId}`);
    console.log(`Token stored securely: ${created.tokenFile}`);
    return;
  }
  if (action === 'adopt') {
    requireValue(account, 'cfm tunnel adopt <account> <existing-profile> [--tunnel-id <id>]');
    requireValue(name, 'cfm tunnel adopt <account> <existing-profile> [--tunnel-id <id>]');
    const adopted = await adoptTunnel(account, name, { tunnelId: options['tunnel-id'] || null, paths });
    console.log(`Adopted existing profile: ${name}`);
    console.log(`Tunnel ID: ${adopted.tunnelId}`);
    console.log('Existing Tunnel Token file was preserved.');
    return;
  }
  if (action === 'show') {
    requireValue(account, 'cfm tunnel show <account> <name>');
    requireValue(name, 'cfm tunnel show <account> <name>');
    return printObject(await showManagedTunnel(account, name, { paths }));
  }
  if (action === 'token') {
    requireValue(account, 'cfm tunnel token <account> <name>');
    requireValue(name, 'cfm tunnel token <account> <name>');
    const tokenFile = await refreshTunnelToken(account, name, { paths });
    console.log(`Tunnel Token refreshed and stored securely: ${tokenFile}`);
    console.log('Raw token is intentionally not printed.');
    return;
  }
  if (action === 'delete') {
    requireValue(account, 'cfm tunnel delete <account> <name> [--yes]');
    requireValue(name, 'cfm tunnel delete <account> <name> [--yes]');
    if (!await confirmAction(`Delete remote Cloudflare Tunnel "${name}" and its local managed profile?`, options)) return console.log('Cancelled.');
    await stopTunnel(name, { quiet: true, paths }).catch(() => {});
    await deleteManagedTunnel(account, name, { paths });
    console.log(`Deleted remote Tunnel and local managed profile: ${name}`);
    return;
  }
  throw new Error('Usage: cfm tunnel <list|create|adopt|show|token|delete> ...');
}

async function runRoute(positionals, options, paths) {
  const action = positionals[0];
  const account = positionals[1];
  const tunnel = positionals[2];
  requireValue(account, 'cfm route <list|add|remove> <account> <tunnel> ...');
  requireValue(tunnel, 'cfm route <list|add|remove> <account> <tunnel> ...');
  if (action === 'list') {
    const routes = await listRoutes(account, tunnel, { paths });
    if (!routes.length) return console.log('No published hostname routes configured.');
    for (const route of routes) console.log(`${route.hostname}\t${route.service}`);
    return;
  }
  if (action === 'add') {
    const hostname = requireValue(options.hostname, 'cfm route add <account> <tunnel> --hostname <hostname> --url <origin> [--dns] [--zone-id <id>]');
    const origin = requireValue(options.url, 'cfm route add <account> <tunnel> --hostname <hostname> --url <origin> [--dns] [--zone-id <id>]');
    const result = await addRoute(account, tunnel, {
      hostname,
      origin,
      zoneId: options['zone-id'] || null,
      manageDns: Boolean(options.dns),
      paths,
    });
    console.log(`Configured ${result.hostname} -> ${result.origin}`);
    console.log(`DNS: ${result.dnsManaged ? 'managed' : 'unchanged'}`);
    if (result.dnsManaged && result.zoneName) console.log(`Zone: ${result.zoneName} (${result.zoneSource})`);
    return;
  }
  if (action === 'remove') {
    const hostname = requireValue(options.hostname, 'cfm route remove <account> <tunnel> --hostname <hostname> [--dns] [--zone-id <id>]');
    await removeRoute(account, tunnel, {
      hostname,
      zoneId: options['zone-id'] || null,
      manageDns: Boolean(options.dns),
      paths,
    });
    console.log(`Removed route: ${hostname}`);
    return;
  }
  throw new Error('Usage: cfm route <list|add|remove> ...');
}

async function runExpose(positionals, options, paths) {
  const account = requireValue(positionals[0], 'cfm expose <account> --name <tunnel> --hostname <hostname> (--port <port>|--url <origin>) [--zone-id <id>] [--no-dns] [--no-start]');
  const result = await expose(account, {
    name: requireValue(options.name, 'cfm expose <account> --name <tunnel> ...'),
    hostname: requireValue(options.hostname, 'cfm expose <account> --hostname <hostname> ...'),
    origin: options.url || null,
    port: options.port || null,
    zoneId: options['zone-id'] || null,
    manageDns: !options['no-dns'],
    start: !options['no-start'],
    startTunnelFn: startTunnel,
    paths,
  });
  console.log(`${result.created ? 'Created' : 'Reused'} Tunnel: ${result.name}`);
  console.log(`Route: ${result.hostname} -> ${result.origin}`);
  if (result.dnsManaged) console.log(`DNS: managed${result.zoneName ? ` in ${result.zoneName}` : ''}`);
  console.log(`Connector: ${result.started ? 'started' : 'not started'}`);
  console.log(`Public URL: ${result.url}`);
}

function printHelp() {
  console.log(`cloudflare-management (cfm)

Manage Cloudflare Tunnel connectors and optionally provision Tunnels/routes through the Cloudflare API.

Token-only / v0.1-compatible commands:
  cfm init
  cfm add <name> [--token-file <path>] [--force]
  cfm remove <name>
  cfm list
  cfm start <name>
  cfm start-all
  cfm stop <name>
  cfm stop-all
  cfm restart <name>
  cfm status [name]
  cfm logs <name> [--follow]
  cfm doctor [name]
  cfm config

Account API mode (v0.2):
  cfm account add <name> [--account-id <id>] [--token-file <path>] [--zone-id <id>] [--force]
  cfm account list
  cfm account show <name>
  cfm account doctor <name> [--hostname <hostname>] [--zone-id <id>]
  cfm account remove <name> [--yes]

  cfm tunnel list <account>
  cfm tunnel create <account> <name>
  cfm tunnel adopt <account> <existing-profile> [--tunnel-id <id>]
  cfm tunnel show <account> <name>
  cfm tunnel token <account> <name>
  cfm tunnel delete <account> <name> [--yes]

  cfm route list <account> <tunnel>
  cfm route add <account> <tunnel> --hostname <host> --url <origin> [--dns] [--zone-id <id>]
  cfm route remove <account> <tunnel> --hostname <host> [--dns] [--zone-id <id>]

  cfm expose <account> --name <tunnel> --hostname <host> (--port <port>|--url <origin>) [--zone-id <id>] [--no-dns] [--no-start]

Upgrade safety:
  Existing profiles created with 'cfm add company-a' migrate as token-only and keep working unchanged.
  Use 'cfm tunnel adopt' only when you explicitly want to attach an existing profile to API management.

Security:
  API Tokens and Tunnel Tokens are stored as mode-600 files and are never printed by normal commands.
`);
}

export async function run(args, { paths = appPaths() } = {}) {
  try {
    if (args.includes('--version') || args.includes('-v')) return console.log(await packageVersion());
    if (args.includes('--help') || args.includes('-h')) return printHelp();
    const { command, positionals, options } = parseArgs(args);
    if (command === 'help') return printHelp();
    if (command === 'init') {
      await ensureDirectories(paths);
      await loadConfig({ paths });
      console.log(`Initialized: ${paths.configRoot}`);
      return;
    }
    if (command === 'add') return addLegacyTunnel(requireValue(positionals[0], 'cfm add <name>'), options, paths);
    if (command === 'remove') return removeLocalTunnel(requireValue(positionals[0], 'cfm remove <name>'), paths);
    if (command === 'list') return listLocalTunnels(paths);
    if (command === 'start') return startTunnel(requireValue(positionals[0], 'cfm start <name>'), { paths });
    if (command === 'start-all') return startAll(paths);
    if (command === 'stop') return stopTunnel(requireValue(positionals[0], 'cfm stop <name>'), { paths });
    if (command === 'stop-all') return stopAll(paths);
    if (command === 'restart') {
      const name = requireValue(positionals[0], 'cfm restart <name>');
      await stopTunnel(name, { quiet: true, paths });
      return startTunnel(name, { paths });
    }
    if (command === 'status') return printStatus(positionals[0] || null, paths);
    if (command === 'logs') return showLogs(requireValue(positionals[0], 'cfm logs <name>'), Boolean(options.follow), paths);
    if (command === 'doctor') return doctor(positionals[0] || null, paths);
    if (command === 'config') return console.log(paths.configFile);
    if (command === 'account') return runAccount(positionals, options, paths);
    if (command === 'tunnel') return runTunnel(positionals, options, paths);
    if (command === 'route') return runRoute(positionals, options, paths);
    if (command === 'expose') return runExpose(positionals, options, paths);
    throw new Error(`Unknown command: ${command}`);
  } catch (error) {
    if (error instanceof CloudflareApiError) throw new Error(formatCloudflareError(error));
    throw error;
  }
}
