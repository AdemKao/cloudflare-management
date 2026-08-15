import fsp from 'node:fs/promises';
import path from 'node:path';
import {
  accountApiTokenPath,
  accountTunnelTokenPath,
  appPaths,
  ensureDirectories,
  legacyTunnelTokenPath,
} from './config.js';

export async function promptHidden(label, { input = process.stdin, output = process.stdout } = {}) {
  if (!input.isTTY || typeof input.setRawMode !== 'function') {
    throw new Error('Interactive secret input requires a TTY. Use --token-file <path> instead.');
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

export async function promptLine(label, { input = process.stdin, output = process.stdout } = {}) {
  if (!input.isTTY) throw new Error('Interactive input requires a TTY.');
  output.write(label);
  input.setEncoding('utf8');
  input.resume();
  return new Promise((resolve, reject) => {
    let value = '';
    const cleanup = () => {
      input.removeListener('data', onData);
      input.removeListener('error', onError);
      input.pause();
    };
    const onError = (error) => {
      cleanup();
      reject(error);
    };
    const onData = (chunk) => {
      value += String(chunk);
      const newline = value.search(/[\r\n]/);
      if (newline === -1) return;
      const result = value.slice(0, newline).trim();
      cleanup();
      resolve(result);
    };
    input.on('error', onError);
    input.on('data', onData);
  });
}

export async function resolveSecret(options, label = 'Token: ') {
  if (typeof options['token-file'] === 'string') {
    const source = path.resolve(options['token-file']);
    const value = (await fsp.readFile(source, 'utf8')).trim();
    if (!value) throw new Error(`Token file is empty: ${source}`);
    return value;
  }
  const value = await promptHidden(label);
  if (!value) throw new Error('Token cannot be empty.');
  return value;
}

export async function writeSecret(filePath, value) {
  if (!value) throw new Error('Secret cannot be empty.');
  await fsp.mkdir(path.dirname(filePath), { recursive: true, mode: 0o700 });
  await fsp.chmod(path.dirname(filePath), 0o700).catch(() => {});
  const temporary = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  await fsp.writeFile(temporary, `${value.trim()}\n`, { mode: 0o600 });
  await fsp.chmod(temporary, 0o600);
  await fsp.rename(temporary, filePath);
  await fsp.chmod(filePath, 0o600);
  return filePath;
}

export async function readSecret(filePath) {
  const value = (await fsp.readFile(filePath, 'utf8')).trim();
  if (!value) throw new Error(`Secret file is empty: ${filePath}`);
  return value;
}

export function accountTokenPath(name, paths = appPaths()) {
  return accountApiTokenPath(name, paths);
}

export function tunnelTokenPath(accountAlias, name, paths = appPaths()) {
  return accountTunnelTokenPath(accountAlias, name, paths);
}

export function unboundTunnelTokenPath(name, paths = appPaths()) {
  return legacyTunnelTokenPath(name, paths);
}

async function fileExists(filePath) {
  try {
    await fsp.access(filePath);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

export async function moveSecret(source, destination) {
  if (path.resolve(source) === path.resolve(destination)) return destination;
  const [sourceExists, destinationExists] = await Promise.all([fileExists(source), fileExists(destination)]);
  if (!sourceExists && !destinationExists) throw new Error(`Secret file is missing: ${source}`);

  if (sourceExists && destinationExists) {
    const [left, right] = await Promise.all([fsp.readFile(source), fsp.readFile(destination)]);
    if (!left.equals(right)) throw new Error(`Refusing to overwrite a different secret file: ${destination}`);
    await fsp.rm(source, { force: true });
    await fsp.chmod(destination, 0o600).catch(() => {});
    return destination;
  }

  if (!sourceExists && destinationExists) {
    await fsp.chmod(destination, 0o600).catch(() => {});
    return destination;
  }

  await fsp.mkdir(path.dirname(destination), { recursive: true, mode: 0o700 });
  await fsp.chmod(path.dirname(destination), 0o700).catch(() => {});
  await fsp.rename(source, destination);
  await fsp.chmod(destination, 0o600);
  return destination;
}

export async function ensureSecretStorage(paths = appPaths()) {
  await ensureDirectories(paths);
  return paths;
}

export async function checkSecretPermissions(filePath) {
  try {
    const stat = await fsp.stat(filePath);
    return (stat.mode & 0o077) === 0 ? 'OK' : 'WARNING: permissions are broader than 600';
  } catch (error) {
    if (error.code === 'ENOENT') return 'MISSING';
    throw error;
  }
}
