import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { spawn, spawnSync } from 'node:child_process';

const APP_NAME = 'cloudflare-management';

export function validateName(name) {
  if (!name || !/^[A-Za-z0-9._-]+$/.test(name)) {
    throw new Error('Name must contain only letters, numbers, dot, underscore, or hyphen.');
  }
  return name;
}

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

function appPaths() {
  const configRoot = process.env.XDG_CONFIG_HOME
    ? path.join(process.env.XDG_CONFIG_HOME, APP_NAME)
    : path.join(os.homedir(), '.config', APP_NAME);

  const stateRoot = process.env.XDG_STATE_HOME
    ? path.join(process.env.XDG_STATE_HOME, APP_NAME)
    : path.join(os.homedir(), '.local', 'state', APP_NAME);

  return {
    configRoot,
    configFile: path.join(configRoot, 'config.json'),
    secretsRoot: path.join(configRoot, 'secrets'),
    stateRoot,
    logsRoot: path.join(stateRoot, 'logs'),
    runtimeRoot: path.join(stateRoot, 'runtime'),
  };
}

async function ensureDirectories() {
  const paths = appPaths();
  await fsp.mkdir(paths.configRoot, { recursive: true, mode: 0o700 });
  await fsp.mkdir(paths.secretsRoot, { recursive: true, mode: 0o700 });
  await fsp.mkdir(paths.stateRoot, { recursive: true, mode: 0o700 });
  await fsp.mkdir(paths.logsRoot, { recursive: true, mode: 0o700 });
  await fsp.mkdir(paths.runtimeRoot, { recursive: true, mode: 0o700 });
  return paths;
}

async function loadConfig() {
  const paths = await ensureDirectories();

  try {
    const raw = await fsp.readFile(paths.configFile, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      version: 1,
      tunnels: parsed.tunnels ?? {},
    };
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    return { version: 1, tunnels: {} };
  }
}

async function saveConfig(config) {
  const paths = await ensureDirectories();
  const temporary = `${paths.configFile}.tmp`;
  await fsp.writeFile(temporary, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
  await fsp.rename(temporary, paths.configFile);
  await fsp.chmod(paths.configFile, 0o600);
}

function runtimePaths(name) {
  const paths = appPaths();
  return {
    stateFile: path.join(paths.runtimeRoot, `${name}.json`),
    logFile: path.join(paths.logsRoot, `${name}.log`),
  };
}

async function readState(name) {
  const { stateFile } = runtimePaths(name);
  try {
    return JSON.parse(await fsp.readFile(stateFile, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

async function writeState(name, state) {
  const { stateFile } = runtimePaths(name);
  await fsp.writeFile(stateFile, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
}

async function deleteState(name) {
  const { stateFile } = runtimePaths(name);
  await fsp.rm(stateFile, { force: true });
}

function isProcessAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function promptHidden(label) {
  const input = process.stdin;
  const output = process.stdout;

  if (!input.isTTY || typeof input.setRawMode !== 'function') {
    throw new Error('Interactive token input requires a TTY. Use --token-file <path> instead.');
  }

  return new Promise((resolve, reject) => {
    let value = '';
    const wasRaw = input.isRaw;

    const cleanup = () => {
      input.removeListener('data', onData);
      input.setRawMode(Boolean(wasRaw));
      input.pause();
    };

    const onData = (chunk) => {
      for (const character of chunk) {
        if (character === '\u0003') {
          cleanup();
          output.write('\n');
          reject(new Error('Cancelled.'));
          return;
        }

        if (character === '\r' || character === '\n') {
          cleanup();
          output.write('\n');
          resolve(value.trim());
          return;
        }

        if (character === '\u007f' || character === '\b') {
          if (value.length > 0) {
            value = value.slice(0, -1);
            output.write('\b \b');
          }
          continue;
        }

        if (character >= ' ') {
          value += character;
          output.write('*');
        }
      }
    };

    output.write(label);
    input.setEncoding('utf8');
    input.setRawMode(true);
    input.resume();
    input.on('data', onData);
  });
}

async function resolveToken(options) {
  if (typeof options['token-file'] === 'string') {
    const source = path.resolve(options['token-file']);
    const token = (await fsp.readFile(source, 'utf8')).trim();
    if (!token) throw new Error(`Token file is empty: ${source}`);
    return token;
  }

  const token = await promptHidden('Tunnel token: ');
  if (!token) throw new Error('Tunnel token cannot be empty.');
  return token;
}

async function addTunnel(name, options) {
  validateName(name);
  const config = await loadConfig();

  if (config.tunnels[name] && !options.force) {
    throw new Error(`Tunnel profile "${name}" already exists. Use --force to replace it.`);
  }

  const token = await resolveToken(options);
  const paths = await ensureDirectories();
  const tokenFile = path.join(paths.secretsRoot, `${name}.token`);

  await fsp.writeFile(tokenFile, `${token}\n`, { mode: 0o600 });
  await fsp.chmod(tokenFile, 0o600);

  config.tunnels[name] = {
    tokenFile,
    createdAt: config.tunnels[name]?.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await saveConfig(config);
  console.log(`Added tunnel profile: ${name}`);
  console.log(`Token stored locally with mode 600: ${tokenFile}`);
}

async function getTunnel(name) {
  validateName(name);
  const config = await loadConfig();
  const tunnel = config.tunnels[name];
  if (!tunnel) throw new Error(`Unknown tunnel profile: ${name}`);
  return tunnel;
}

function cloudflaredVersion() {
  const result = spawnSync('cloudflared', ['--version'], { encoding: 'utf8' });
  if (result.error) return null;
  if (result.status !== 0) return null;
  return (result.stdout || result.stderr || '').trim();
}

async function tailText(filePath, lineCount = 40) {
  try {
    const text = await fsp.readFile(filePath, 'utf8');
    return text.split(/\r?\n/).slice(-lineCount).join('\n').trim();
  } catch (error) {
    if (error.code === 'ENOENT') return '';
    throw error;
  }
}

async function startTunnel(name, { quiet = false } = {}) {
  const tunnel = await getTunnel(name);
  const existing = await readState(name);

  if (existing && isProcessAlive(existing.pid)) {
    if (!quiet) console.log(`${name} is already running (PID ${existing.pid}).`);
    return;
  }

  if (!cloudflaredVersion()) {
    throw new Error('cloudflared is not installed or not available in PATH.');
  }

  try {
    await fsp.access(tunnel.tokenFile, fs.constants.R_OK);
  } catch {
    throw new Error(`Tunnel token file is missing or unreadable: ${tunnel.tokenFile}`);
  }

  await ensureDirectories();
  const { logFile } = runtimePaths(name);
  const logFd = fs.openSync(logFile, 'a');
  const child = spawn(
    'cloudflared',
    ['tunnel', 'run', '--token-file', tunnel.tokenFile],
    {
      detached: true,
      stdio: ['ignore', logFd, logFd],
      env: process.env,
    },
  );

  child.unref();
  fs.closeSync(logFd);

  await writeState(name, {
    pid: child.pid,
    startedAt: new Date().toISOString(),
    logFile,
  });

  await sleep(700);
  if (!isProcessAlive(child.pid)) {
    await deleteState(name);
    const recentLogs = await tailText(logFile, 20);
    throw new Error(
      recentLogs
        ? `cloudflared exited immediately. Recent logs:\n${recentLogs}`
        : 'cloudflared exited immediately. Check the tunnel token and Cloudflare configuration.',
    );
  }

  if (!quiet) {
    console.log(`Started ${name} (PID ${child.pid}).`);
    console.log(`Logs: ${logFile}`);
  }
}

async function stopTunnel(name, { quiet = false } = {}) {
  await getTunnel(name);
  const state = await readState(name);

  if (!state || !isProcessAlive(state.pid)) {
    await deleteState(name);
    if (!quiet) console.log(`${name} is not running.`);
    return;
  }

  process.kill(state.pid, 'SIGTERM');

  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (!isProcessAlive(state.pid)) break;
    await sleep(100);
  }

  await deleteState(name);
  if (!quiet) console.log(`Stopped ${name}.`);
}

async function removeTunnel(name) {
  const tunnel = await getTunnel(name);
  await stopTunnel(name, { quiet: true });
  const config = await loadConfig();
  delete config.tunnels[name];
  await saveConfig(config);
  await fsp.rm(tunnel.tokenFile, { force: true });
  const { logFile } = runtimePaths(name);
  await fsp.rm(logFile, { force: true });
  console.log(`Removed tunnel profile: ${name}`);
}

async function tunnelStatus(name) {
  const state = await readState(name);
  if (!state) return { status: 'stopped', pid: '-' };
  if (!isProcessAlive(state.pid)) {
    await deleteState(name);
    return { status: 'stopped', pid: '-' };
  }
  return { status: 'running', pid: String(state.pid) };
}

async function printStatus(nameFilter = null) {
  const config = await loadConfig();
  const names = nameFilter ? [nameFilter] : Object.keys(config.tunnels).sort();

  if (nameFilter && !config.tunnels[nameFilter]) {
    throw new Error(`Unknown tunnel profile: ${nameFilter}`);
  }

  if (names.length === 0) {
    console.log('No tunnel profiles configured. Use: cfm add <name>');
    return;
  }

  const rows = [];
  for (const name of names) {
    const status = await tunnelStatus(name);
    rows.push({ name, ...status });
  }

  const nameWidth = Math.max(4, ...rows.map((row) => row.name.length));
  console.log(`${'NAME'.padEnd(nameWidth)}  STATUS   PID`);
  for (const row of rows) {
    console.log(`${row.name.padEnd(nameWidth)}  ${row.status.padEnd(8)} ${row.pid}`);
  }
}

async function showLogs(name, follow) {
  await getTunnel(name);
  const { logFile } = runtimePaths(name);

  if (!follow) {
    const logs = await tailText(logFile, 80);
    console.log(logs || `No logs yet for ${name}.`);
    return;
  }

  await fsp.appendFile(logFile, '');
  await new Promise((resolve, reject) => {
    const child = spawn('tail', ['-n', '80', '-f', logFile], { stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', () => resolve());
  });
}

async function doctor(nameFilter = null) {
  const config = await loadConfig();
  const version = cloudflaredVersion();
  const paths = appPaths();

  console.log(`Node:        ${process.version}`);
  console.log(`cloudflared: ${version ?? 'NOT FOUND'}`);
  console.log(`Config:      ${paths.configFile}`);

  const names = nameFilter ? [nameFilter] : Object.keys(config.tunnels).sort();
  if (nameFilter && !config.tunnels[nameFilter]) {
    throw new Error(`Unknown tunnel profile: ${nameFilter}`);
  }

  for (const name of names) {
    const tunnel = config.tunnels[name];
    let token = 'OK';
    try {
      await fsp.access(tunnel.tokenFile, fs.constants.R_OK);
      const stat = await fsp.stat(tunnel.tokenFile);
      if ((stat.mode & 0o077) !== 0) token = 'WARNING: permissions are broader than 600';
    } catch {
      token = 'MISSING';
    }
    const status = await tunnelStatus(name);
    console.log(`${name}: ${status.status}; token=${token}`);
  }

  if (!version) process.exitCode = 1;
}

async function startAll() {
  const config = await loadConfig();
  const names = Object.keys(config.tunnels).sort();
  if (names.length === 0) {
    console.log('No tunnel profiles configured.');
    return;
  }

  for (const name of names) {
    try {
      await startTunnel(name, { quiet: true });
      console.log(`Started ${name}.`);
    } catch (error) {
      console.error(`Failed ${name}: ${error.message}`);
      process.exitCode = 1;
    }
  }
}

async function stopAll() {
  const config = await loadConfig();
  for (const name of Object.keys(config.tunnels).sort()) {
    try {
      await stopTunnel(name, { quiet: true });
      console.log(`Stopped ${name}.`);
    } catch (error) {
      console.error(`Failed ${name}: ${error.message}`);
      process.exitCode = 1;
    }
  }
}

async function packageVersion() {
  const packageUrl = new URL('../package.json', import.meta.url);
  const data = JSON.parse(await fsp.readFile(packageUrl, 'utf8'));
  return data.version;
}

function printHelp() {
  console.log(`cloudflare-management (cfm)

Manage multiple remotely-managed Cloudflare Tunnel connectors from one development machine.

Usage:
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
  cfm --version

Examples:
  cfm add claire
  cfm add client-b --token-file ~/Downloads/client-b.token
  cfm start claire
  cfm status
  cfm logs claire --follow

Notes:
  - Create the remotely-managed Tunnel and Published Application routes in each client's Cloudflare account first.
  - Tunnel tokens are stored only on this machine under ~/.config/cloudflare-management/secrets/ with mode 600.
  - Never commit tunnel tokens to Git.
`);
}

export async function run(args) {
  if (args.includes('--version') || args.includes('-v')) {
    console.log(await packageVersion());
    return;
  }

  if (args.includes('--help') || args.includes('-h')) {
    printHelp();
    return;
  }

  const { command, positionals, options } = parseArgs(args);
  const name = positionals[0];

  switch (command) {
    case 'help':
      printHelp();
      break;
    case 'init': {
      const paths = await ensureDirectories();
      const config = await loadConfig();
      await saveConfig(config);
      console.log(`Initialized: ${paths.configFile}`);
      break;
    }
    case 'add':
      if (!name) throw new Error('Usage: cfm add <name> [--token-file <path>]');
      await addTunnel(name, options);
      break;
    case 'remove':
      if (!name) throw new Error('Usage: cfm remove <name>');
      await removeTunnel(name);
      break;
    case 'list':
    case 'status':
      await printStatus(name ?? null);
      break;
    case 'start':
      if (!name) throw new Error('Usage: cfm start <name>');
      await startTunnel(name);
      break;
    case 'start-all':
      await startAll();
      break;
    case 'stop':
      if (!name) throw new Error('Usage: cfm stop <name>');
      await stopTunnel(name);
      break;
    case 'stop-all':
      await stopAll();
      break;
    case 'restart':
      if (!name) throw new Error('Usage: cfm restart <name>');
      await stopTunnel(name, { quiet: true });
      await startTunnel(name);
      break;
    case 'logs':
      if (!name) throw new Error('Usage: cfm logs <name> [--follow]');
      await showLogs(name, Boolean(options.follow));
      break;
    case 'doctor':
      await doctor(name ?? null);
      break;
    case 'config':
      console.log(appPaths().configFile);
      break;
    default:
      throw new Error(`Unknown command: ${command}. Run "cfm --help".`);
  }
}
