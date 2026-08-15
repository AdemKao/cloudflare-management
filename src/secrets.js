import fsp from 'node:fs/promises';
import path from 'node:path';
import { appPaths, ensureDirectories } from './config.js';

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
  return path.join(paths.accountSecretsRoot, `${name}.api-token`);
}

export function tunnelTokenPath(name, paths = appPaths()) {
  return path.join(paths.tunnelSecretsRoot, `${name}.token`);
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
