export function validateName(name) {
  if (!name || !/^[A-Za-z0-9._-]+$/.test(name)) {
    throw new Error('Name must contain only letters, numbers, dot, underscore, or hyphen.');
  }
  return name;
}

export function validateAccountId(value) {
  if (!value || !/^[A-Fa-f0-9]{16,64}$/.test(value)) {
    throw new Error('Cloudflare Account ID must be a hexadecimal identifier.');
  }
  return value;
}

export function validateTunnelId(value) {
  if (!value || !/^[A-Fa-f0-9-]{16,64}$/.test(value)) {
    throw new Error('Cloudflare Tunnel ID must be a UUID-like identifier.');
  }
  return value;
}

export function validateZoneId(value) {
  if (!value || !/^[A-Fa-f0-9]{16,64}$/.test(value)) {
    throw new Error('Cloudflare Zone ID must be a hexadecimal identifier.');
  }
  return value;
}

export function validateHostname(value) {
  if (!value || value.length > 253 || !/^(?=.{1,253}$)(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/.test(value)) {
    throw new Error('Hostname must be a valid fully-qualified DNS name.');
  }
  return value.toLowerCase();
}

export function validateOrigin(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error('Origin must be a valid URL such as http://localhost:3001.');
  }
  if (!['http:', 'https:', 'tcp:', 'ssh:'].includes(url.protocol)) {
    throw new Error('Origin protocol must be http, https, tcp, or ssh.');
  }
  return value;
}
