import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

export const APP_NAME = 'cloudflare-management';
export const CONFIG_VERSION = 3;

const SAFE_STORAGE_NAME = /^[A-Za-z0-9._-]+$/;

function assertStorageName(name, kind) {
  if (!SAFE_STORAGE_NAME.test(name)) throw new Error(`Invalid ${kind} alias in config: ${name}`);
  return name;
}

export function appPaths(env = process.env, home = os.homedir()) {
  const configRoot = env.XDG_CONFIG_HOME
    ? path.join(env.XDG_CONFIG_HOME, APP_NAME)
    : path.join(home, '.config', APP_NAME);
  const stateRoot = env.XDG_STATE_HOME
    ? path.join(env.XDG_STATE_HOME, APP_NAME)
    : path.join(home, '.local', 'state', APP_NAME);

  const backupsRoot = path.join(configRoot, 'backups');
  const accountsRoot = path.join(configRoot, 'accounts');
  const legacyRoot = path.join(configRoot, 'legacy');
  const legacyTunnelsRoot = path.join(legacyRoot, 'tunnels');
  const oldSecretsRoot = path.join(configRoot, 'secrets');

  return {
    configRoot,
    configFile: path.join(configRoot, 'config.json'),
    backupsRoot,
    backupFile: path.join(backupsRoot, 'config.v1.backup.json'),
    v1BackupFile: path.join(backupsRoot, 'config.v1.backup.json'),
    v2BackupFile: path.join(backupsRoot, 'config.v2.backup.json'),
    legacyV1BackupFile: path.join(configRoot, 'config.v1.backup.json'),
    accountsRoot,
    legacyRoot,
    legacyTunnelsRoot,
    // v0.1/v0.2 paths retained only so migration can locate old secrets.
    secretsRoot: oldSecretsRoot,
    accountSecretsRoot: path.join(oldSecretsRoot, 'accounts'),
    tunnelSecretsRoot: path.join(oldSecretsRoot, 'tunnels'),
    stateRoot,
    logsRoot: path.join(stateRoot, 'logs'),
    runtimeRoot: path.join(stateRoot, 'runtime'),
  };
}

export function accountRootPath(accountAlias, paths = appPaths()) {
  return path.join(paths.accountsRoot, assertStorageName(accountAlias, 'account'));
}

export function accountApiTokenPath(accountAlias, paths = appPaths()) {
  return path.join(accountRootPath(accountAlias, paths), 'api-token');
}

export function accountTunnelTokenPath(accountAlias, profileName, paths = appPaths()) {
  return path.join(
    accountRootPath(accountAlias, paths),
    'tunnels',
    `${assertStorageName(profileName, 'tunnel/profile')}.token`,
  );
}

export function legacyTunnelTokenPath(profileName, paths = appPaths()) {
  return path.join(paths.legacyTunnelsRoot, `${assertStorageName(profileName, 'tunnel/profile')}.token`);
}

export async function ensureDirectories(paths = appPaths()) {
  for (const dir of [
    paths.configRoot,
    paths.backupsRoot,
    paths.accountsRoot,
    paths.legacyRoot,
    paths.legacyTunnelsRoot,
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

function normalizeV3(parsed) {
  return {
    version: CONFIG_VERSION,
    accounts: parsed.accounts ?? {},
    tunnels: parsed.tunnels ?? {},
  };
}

function normalizeV2(parsed) {
  return {
    version: 2,
    accounts: parsed.accounts ?? {},
    tunnels: parsed.tunnels ?? {},
  };
}

export function migrateV1Object(parsed) {
  const migrated = { version: 2, accounts: {}, tunnels: {} };
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
  await fsp.mkdir(path.dirname(filePath), { recursive: true, mode: 0o700 });
  const temporary = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  await fsp.writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  await fsp.chmod(temporary, 0o600);
  await fsp.rename(temporary, filePath);
  await fsp.chmod(filePath, 0o600);
}

async function exists(filePath) {
  try {
    await fsp.access(filePath);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

async function sameContents(left, right) {
  const [a, b] = await Promise.all([fsp.readFile(left), fsp.readFile(right)]);
  return a.equals(b);
}

async function preserveBackup(sourceFile, destinationFile) {
  if (await exists(destinationFile)) return destinationFile;
  await fsp.mkdir(path.dirname(destinationFile), { recursive: true, mode: 0o700 });
  await fsp.copyFile(sourceFile, destinationFile);
  await fsp.chmod(destinationFile, 0o600);
  return destinationFile;
}

async function migrateLegacyBackupLocation(paths) {
  if (!await exists(paths.legacyV1BackupFile) || await exists(paths.v1BackupFile)) return;
  await fsp.mkdir(paths.backupsRoot, { recursive: true, mode: 0o700 });
  await fsp.copyFile(paths.legacyV1BackupFile, paths.v1BackupFile);
  await fsp.chmod(paths.v1BackupFile, 0o600);
}

function targetSecretPath(profileName, tunnel, paths) {
  if (tunnel.account && ['adopted', 'provisioned'].includes(tunnel.managementMode)) {
    return accountTunnelTokenPath(tunnel.account, profileName, paths);
  }
  return legacyTunnelTokenPath(profileName, paths);
}

function buildV3Config(v2, paths) {
  const target = emptyConfig();
  const relocations = [];

  for (const [alias, account] of Object.entries(v2.accounts ?? {})) {
    assertStorageName(alias, 'account');
    const destination = accountApiTokenPath(alias, paths);
    target.accounts[alias] = { ...account, apiTokenFile: destination };
    if (account.apiTokenFile && path.resolve(account.apiTokenFile) !== path.resolve(destination)) {
      relocations.push({ kind: 'account-api-token', name: alias, source: account.apiTokenFile, destination });
    }
  }

  for (const [profileName, tunnel] of Object.entries(v2.tunnels ?? {})) {
    assertStorageName(profileName, 'tunnel/profile');
    if (tunnel.account) assertStorageName(tunnel.account, 'account');
    const normalizedTunnel = {
      ...tunnel,
      managementMode: tunnel.managementMode ?? 'token-only',
      account: tunnel.account ?? null,
      tunnelId: tunnel.tunnelId ?? null,
      remoteName: tunnel.remoteName ?? null,
    };
    const destination = targetSecretPath(profileName, normalizedTunnel, paths);
    target.tunnels[profileName] = { ...normalizedTunnel, tokenFile: destination };
    if (tunnel.tokenFile && path.resolve(tunnel.tokenFile) !== path.resolve(destination)) {
      relocations.push({ kind: 'tunnel-token', name: profileName, source: tunnel.tokenFile, destination });
    }
  }

  return { target, relocations };
}

async function inspectRelocation(relocation) {
  const sourceExists = await exists(relocation.source);
  const destinationExists = await exists(relocation.destination);
  if (!sourceExists && !destinationExists) {
    throw new Error(`Cannot migrate ${relocation.kind} "${relocation.name}": both source and destination secret files are missing.`);
  }
  if (sourceExists && destinationExists && !await sameContents(relocation.source, relocation.destination)) {
    throw new Error(
      `Refusing to migrate ${relocation.kind} "${relocation.name}": destination already exists with different contents: ${relocation.destination}`,
    );
  }
  return { sourceExists, destinationExists };
}

async function applyRelocation(relocation, state) {
  await fsp.mkdir(path.dirname(relocation.destination), { recursive: true, mode: 0o700 });
  await fsp.chmod(path.dirname(relocation.destination), 0o700).catch(() => {});
  if (state.sourceExists && !state.destinationExists) {
    await fsp.rename(relocation.source, relocation.destination);
  }
  await fsp.chmod(relocation.destination, 0o600).catch(() => {});
}

async function cleanupOldSecret(source, destination) {
  if (path.resolve(source) === path.resolve(destination)) return;
  if (!await exists(source) || !await exists(destination)) return;
  if (await sameContents(source, destination)) await fsp.rm(source, { force: true });
}

async function cleanupOldDirectories(paths) {
  for (const dir of [paths.accountSecretsRoot, paths.tunnelSecretsRoot, paths.secretsRoot]) {
    await fsp.rmdir(dir).catch(() => {});
  }
}

export async function migrateToLatest({ paths = appPaths(), dryRun = false } = {}) {
  if (!dryRun) {
    await ensureDirectories(paths);
    await migrateLegacyBackupLocation(paths);
  }

  let raw;
  try {
    raw = await fsp.readFile(paths.configFile, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') {
      return { fromVersion: CONFIG_VERSION, toVersion: CONFIG_VERSION, changed: false, actions: [], config: emptyConfig() };
    }
    throw error;
  }

  const parsed = JSON.parse(raw);
  if (parsed.version === CONFIG_VERSION) {
    return { fromVersion: CONFIG_VERSION, toVersion: CONFIG_VERSION, changed: false, actions: [], config: normalizeV3(parsed) };
  }
  if (![undefined, null, 1, 2].includes(parsed.version)) {
    throw new Error(`Unsupported config version: ${parsed.version}`);
  }

  const fromVersion = parsed.version ?? 1;
  const v2 = fromVersion === 2 ? normalizeV2(parsed) : migrateV1Object(parsed);
  const { target, relocations } = buildV3Config(v2, paths);
  const inspected = [];
  for (const relocation of relocations) {
    inspected.push({ relocation, state: await inspectRelocation(relocation) });
  }

  const actions = relocations.map(({ kind, name, source, destination }) => ({ kind, name, source, destination }));
  if (dryRun) {
    return { fromVersion, toVersion: CONFIG_VERSION, changed: true, actions, config: target };
  }

  const backupFile = fromVersion === 2 ? paths.v2BackupFile : paths.v1BackupFile;
  await preserveBackup(paths.configFile, backupFile);

  // File moves are intentionally recoverable: if the process stops after a rename but
  // before config.json is replaced, the next migration sees source-missing/destination-present
  // and continues safely from the same v1/v2 metadata.
  for (const { relocation, state } of inspected) await applyRelocation(relocation, state);
  await atomicWriteJson(paths.configFile, target);
  for (const { relocation } of inspected) await cleanupOldSecret(relocation.source, relocation.destination);
  await cleanupOldDirectories(paths);

  return { fromVersion, toVersion: CONFIG_VERSION, changed: true, actions, config: target, backupFile };
}

export async function saveConfig(config, paths = appPaths()) {
  await ensureDirectories(paths);
  await atomicWriteJson(paths.configFile, normalizeV3(config));
}

export async function loadConfig({ paths = appPaths(), migrate = true } = {}) {
  await ensureDirectories(paths);
  await migrateLegacyBackupLocation(paths);
  let parsed;
  try {
    parsed = JSON.parse(await fsp.readFile(paths.configFile, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return emptyConfig();
    throw error;
  }

  if (parsed.version === CONFIG_VERSION) return normalizeV3(parsed);
  if (!migrate) return parsed;
  return (await migrateToLatest({ paths })).config;
}

export async function restoreV1Backup(paths = appPaths()) {
  await ensureDirectories(paths);
  const candidate = await exists(paths.v1BackupFile) ? paths.v1BackupFile : paths.legacyV1BackupFile;
  const raw = await fsp.readFile(candidate, 'utf8');
  JSON.parse(raw);
  const temporary = `${paths.configFile}.restore-${process.pid}-${Date.now()}`;
  await fsp.writeFile(temporary, raw, { mode: 0o600 });
  await fsp.rename(temporary, paths.configFile);
  await fsp.chmod(paths.configFile, 0o600);
}
