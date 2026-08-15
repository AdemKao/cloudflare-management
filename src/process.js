import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { appPaths, ensureDirectories, loadConfig, saveConfig } from './config.js';
import { checkSecretPermissions } from './secrets.js';
import { validateName } from './validation.js';

function runtimePaths(name, paths = appPaths()) {
  return {
    stateFile: path.join(paths.runtimeRoot, `${name}.json`),
    logFile: path.join(paths.logsRoot, `${name}.log`),
  };
}

async function readState(name, paths = appPaths()) {
  try {
    return JSON.parse(await fsp.readFile(runtimePaths(name, paths).stateFile, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

async function writeState(name, state, paths = appPaths()) {
  await ensureDirectories(paths);
  await fsp.writeFile(runtimePaths(name, paths).stateFile, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
}

async function deleteState(name, paths = appPaths()) {
  await fsp.rm(runtimePaths(name, paths).stateFile, { force: true });
}

export function isProcessAlive(pid) {
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

export function cloudflaredVersion() {
  const result = spawnSync('cloudflared', ['--version'], { encoding: 'utf8' });
  if (result.error || result.status !== 0) return null;
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

export async function getLocalTunnel(name, paths = appPaths()) {
  validateName(name);
  const config = await loadConfig({ paths });
  const tunnel = config.tunnels[name];
  if (!tunnel) throw new Error(`Unknown tunnel profile: ${name}`);
  return { config, tunnel };
}

export async function startTunnel(name, { quiet = false, paths = appPaths() } = {}) {
  const { tunnel } = await getLocalTunnel(name, paths);
  const existing = await readState(name, paths);
  if (existing && isProcessAlive(existing.pid)) {
    if (!quiet) console.log(`${name} is already running (PID ${existing.pid}).`);
    return existing;
  }
  if (!cloudflaredVersion()) throw new Error('cloudflared is not installed or not available in PATH.');
  try {
    await fsp.access(tunnel.tokenFile, fs.constants.R_OK);
  } catch {
    throw new Error(`Tunnel token file is missing or unreadable: ${tunnel.tokenFile}`);
  }

  await ensureDirectories(paths);
  const { logFile } = runtimePaths(name, paths);
  const logFd = fs.openSync(logFile, 'a');
  const child = spawn('cloudflared', ['tunnel', 'run', '--token-file', tunnel.tokenFile], {
    detached: true,
    stdio: ['ignore', logFd, logFd],
    env: process.env,
  });
  child.unref();
  fs.closeSync(logFd);
  const state = { pid: child.pid, startedAt: new Date().toISOString(), logFile };
  await writeState(name, state, paths);
  await sleep(700);
  if (!isProcessAlive(child.pid)) {
    await deleteState(name, paths);
    const recentLogs = await tailText(logFile, 20);
    throw new Error(recentLogs ? `cloudflared exited immediately. Recent logs:\n${recentLogs}` : 'cloudflared exited immediately. Check the tunnel token and Cloudflare configuration.');
  }
  if (!quiet) {
    console.log(`Started ${name} (PID ${child.pid}).`);
    console.log(`Logs: ${logFile}`);
  }
  return state;
}

export async function stopTunnel(name, { quiet = false, paths = appPaths() } = {}) {
  await getLocalTunnel(name, paths);
  const state = await readState(name, paths);
  if (!state || !isProcessAlive(state.pid)) {
    await deleteState(name, paths);
    if (!quiet) console.log(`${name} is not running.`);
    return;
  }
  process.kill(state.pid, 'SIGTERM');
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (!isProcessAlive(state.pid)) break;
    await sleep(100);
  }
  await deleteState(name, paths);
  if (!quiet) console.log(`Stopped ${name}.`);
}

export async function tunnelStatus(name, paths = appPaths()) {
  const state = await readState(name, paths);
  if (!state) return { status: 'stopped', pid: '-' };
  if (!isProcessAlive(state.pid)) {
    await deleteState(name, paths);
    return { status: 'stopped', pid: '-' };
  }
  return { status: 'running', pid: String(state.pid) };
}

export async function printStatus(nameFilter = null, paths = appPaths()) {
  const config = await loadConfig({ paths });
  const names = nameFilter ? [nameFilter] : Object.keys(config.tunnels).sort();
  if (nameFilter && !config.tunnels[nameFilter]) throw new Error(`Unknown tunnel profile: ${nameFilter}`);
  if (names.length === 0) {
    console.log('No tunnel profiles configured. Use: cfm add <name>');
    return;
  }
  const rows = [];
  for (const name of names) rows.push({ name, ...(await tunnelStatus(name, paths)) });
  const nameWidth = Math.max(4, ...rows.map((row) => row.name.length));
  console.log(`${'NAME'.padEnd(nameWidth)}  STATUS   PID`);
  for (const row of rows) console.log(`${row.name.padEnd(nameWidth)}  ${row.status.padEnd(8)} ${row.pid}`);
}

export async function showLogs(name, follow, paths = appPaths()) {
  await getLocalTunnel(name, paths);
  const { logFile } = runtimePaths(name, paths);
  if (!follow) {
    const logs = await tailText(logFile, 80);
    console.log(logs || `No logs yet for ${name}.`);
    return;
  }
  await fsp.appendFile(logFile, '');
  await new Promise((resolve, reject) => {
    const child = spawn('tail', ['-n', '80', '-f', logFile], { stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', resolve);
  });
}

export async function doctor(nameFilter = null, paths = appPaths()) {
  const config = await loadConfig({ paths });
  const version = cloudflaredVersion();
  console.log(`Node:        ${process.version}`);
  console.log(`cloudflared: ${version ?? 'NOT FOUND'}`);
  console.log(`Config:      ${paths.configFile}`);
  const names = nameFilter ? [nameFilter] : Object.keys(config.tunnels).sort();
  if (nameFilter && !config.tunnels[nameFilter]) throw new Error(`Unknown tunnel profile: ${nameFilter}`);
  for (const name of names) {
    const token = await checkSecretPermissions(config.tunnels[name].tokenFile);
    const status = await tunnelStatus(name, paths);
    console.log(`${name}: ${status.status}; mode=${config.tunnels[name].managementMode ?? 'token-only'}; token=${token}`);
  }
  if (!version) process.exitCode = 1;
}

export async function removeLocalTunnel(name, paths = appPaths()) {
  const { config, tunnel } = await getLocalTunnel(name, paths);
  await stopTunnel(name, { quiet: true, paths });
  delete config.tunnels[name];
  await saveConfig(config, paths);
  await fsp.rm(tunnel.tokenFile, { force: true });
  await fsp.rm(runtimePaths(name, paths).logFile, { force: true });
  console.log(`Removed tunnel profile: ${name}`);
}

export async function startAll(paths = appPaths()) {
  const config = await loadConfig({ paths });
  for (const name of Object.keys(config.tunnels).sort()) {
    try {
      await startTunnel(name, { quiet: true, paths });
      console.log(`Started ${name}.`);
    } catch (error) {
      console.error(`Failed ${name}: ${error.message}`);
      process.exitCode = 1;
    }
  }
}

export async function stopAll(paths = appPaths()) {
  const config = await loadConfig({ paths });
  for (const name of Object.keys(config.tunnels).sort()) {
    try {
      await stopTunnel(name, { quiet: true, paths });
      console.log(`Stopped ${name}.`);
    } catch (error) {
      console.error(`Failed ${name}: ${error.message}`);
      process.exitCode = 1;
    }
  }
}
