import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

export const APP_NAME = 'cloudflare-management';
export const CONFIG_VERSION = 2;

export function appPaths(env = process.env, home = os.homedir()) {
  const configRoot = env.XDG_CONFIG_HOME
    ? path.join(env.XDG_CONFIG_HOME, APP_NAME)
    : path.join(home, '.config', APP_NAME);
  const stateRoot = env.XDG_STATE_HOME
    ? path.join(env.XDG_STATE_HOME, APP_NAME)
    : path.join(home, '.local', 'state', APP_NAME);
  const secretsRoot = path.join(configRoot, 'secrets');

  return {
    configRoot,
    configFile: path.join(configRoot, 'config.json'),
    backupFile: path.join(configRoot, 'config.v1.backup.json'),
    secretsRoot,
    accountSecretsRoot: path.join(secretsRoot, 'accounts'),
    tunnelSecretsRoot: path.join(secretsRoot, 'tunnels'),
    stateRoot,
    logsRoot: path.join(stateRoot, 'logs'),
    runtimeRoot: path.join(stateRoot, 'runtime'),
  };
}

export async function ensureDirectories(paths = appPaths()) {
  for (const dir of [
    paths.configRoot,
    paths.secretsRoot,
    paths.accountSecretsRoot,
    paths.tunnelSecretsRoot,
    paths.stateRoot,
    paths.logsRoot,
    paths.runtimeRoot,
  ]) {
    await fsp.mkdir(dir, { recursive: true, mode: 0o700 });
    await fsp.chmod(dir, 0o700).catch(() => {});
  }
  return paths;
}

export function emptyConfig() {
  return { version: CONFIG_VERSION, accounts: {}, tunnels: {} };
}

function normalizeV2(parsed) {
  return {
    version: CONFIG_VERSION,
    accounts: parsed.accounts ?? {},
    tunnels: parsed.tunnels ?? {},
  };
}

export function migrateV1Object(parsed) {
  const migrated = emptyConfig();
  for (const [name, tunnel] of Object.entries(parsed.tunnels ?? {})) {
    migrated.tunnels[name] = {
      ...tunnel,
      managementMode: tunnel.managementMode ?? 'token-only',
      account: tunnel.account ?? null,
      tunnelId: tunnel.tunnelId ?? null,
      remoteName: tunnel.remoteName ?? null,
    };
  }
  return migrated;
}

async function atomicWriteJson(filePath, value) {
  const temporary = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  await fsp.writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  await fsp.chmod(temporary, 0o600);
  await fsp.rename(temporary, filePath);
  await fsp.chmod(filePath, 0o600);
}

export async function saveConfig(config, paths = appPaths()) {
  await ensureDirectories(paths);
  await atomicWriteJson(paths.configFile, normalizeV2(config));
}

export async function loadConfig({ paths = appPaths(), migrate = true } = {}) {
  await ensureDirectories(paths);
  let parsed;
  try {
    parsed = JSON.parse(await fsp.readFile(paths.configFile, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return emptyConfig();
    throw error;
  }

  if (parsed.version === CONFIG_VERSION) return normalizeV2(parsed);
  if (parsed.version != null && parsed.version !== 1) {
    throw new Error(`Unsupported config version: ${parsed.version}`);
  }
  if (!migrate) return parsed;

  try {
    await fsp.access(paths.backupFile);
  } catch {
    await fsp.copyFile(paths.configFile, paths.backupFile);
    await fsp.chmod(paths.backupFile, 0o600);
  }

  const migrated = migrateV1Object(parsed);
  await atomicWriteJson(paths.configFile, migrated);
  return migrated;
}

export async function restoreV1Backup(paths = appPaths()) {
  await ensureDirectories(paths);
  const raw = await fsp.readFile(paths.backupFile, 'utf8');
  JSON.parse(raw);
  const temporary = `${paths.configFile}.restore-${process.pid}-${Date.now()}`;
  await fsp.writeFile(temporary, raw, { mode: 0o600 });
  await fsp.rename(temporary, paths.configFile);
  await fsp.chmod(paths.configFile, 0o600);
}
