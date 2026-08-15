# Configuration

`cloudflare-management` keeps configuration metadata, secrets, runtime state, and logs outside the repository.

## Default paths

```text
~/.config/cloudflare-management/
├── config.json
├── config.v1.backup.json        # only created during a v1 → v2 migration
└── secrets/
    ├── company-a.token          # existing/token-only profile path may remain here
    ├── accounts/
    │   └── company-a.api-token
    └── tunnels/
        └── project-dev.token

~/.local/state/cloudflare-management/
├── logs/
│   └── <profile>.log
└── runtime/
    └── <profile>.json
```

## XDG support

When `XDG_CONFIG_HOME` is set:

```text
$XDG_CONFIG_HOME/cloudflare-management/
```

When `XDG_STATE_HOME` is set:

```text
$XDG_STATE_HOME/cloudflare-management/
```

## Schema v2

A simplified v0.2 configuration:

```json
{
  "version": 2,
  "accounts": {
    "company-a": {
      "accountId": "ACCOUNT_ID",
      "apiTokenFile": "/Users/you/.config/cloudflare-management/secrets/accounts/company-a.api-token",
      "defaultZoneId": "ZONE_ID"
    }
  },
  "tunnels": {
    "company-a": {
      "managementMode": "adopted",
      "account": "company-a",
      "tunnelId": "TUNNEL_UUID",
      "remoteName": "company-a-dev",
      "tokenFile": "/Users/you/.config/cloudflare-management/secrets/company-a.token"
    },
    "project-dev": {
      "managementMode": "provisioned",
      "account": "company-a",
      "tunnelId": "TUNNEL_UUID_2",
      "remoteName": "project-dev",
      "tokenFile": "/Users/you/.config/cloudflare-management/secrets/tunnels/project-dev.token"
    }
  }
}
```

Raw API Tokens and Tunnel Tokens are never embedded in `config.json`.

## Management modes

```text
token-only
  Existing/manual Tunnel; only a local Tunnel Token is required.

adopted
  Existing/manual Tunnel explicitly attached to an Account alias + remote Tunnel ID.

provisioned
  Tunnel created by cfm through the Cloudflare API.
```

## v1 migration

When a v1 config is loaded for the first time, `cfm`:

1. reads the existing metadata;
2. creates `config.v1.backup.json` before mutation;
3. converts existing profiles to `token-only` records;
4. preserves existing profile names and Tunnel Token paths;
5. writes schema v2 atomically.

Example v1 profile:

```json
{
  "version": 1,
  "tunnels": {
    "company-a": {
      "tokenFile": "/Users/you/.config/cloudflare-management/secrets/company-a.token"
    }
  }
}
```

becomes logically:

```json
{
  "version": 2,
  "accounts": {},
  "tunnels": {
    "company-a": {
      "managementMode": "token-only",
      "account": null,
      "tunnelId": null,
      "remoteName": null,
      "tokenFile": "/Users/you/.config/cloudflare-management/secrets/company-a.token"
    }
  }
}
```

The old secret file is not moved or rewritten merely because the config schema changed.

## Account API Token files

Account credentials are stored separately:

```text
~/.config/cloudflare-management/secrets/accounts/<account>.api-token
```

They are created with restrictive permissions and referenced from account metadata.

## Tunnel Token files

Existing/token-only profiles can keep their current location:

```text
~/.config/cloudflare-management/secrets/company-a.token
```

New API-provisioned Tunnels use:

```text
~/.config/cloudflare-management/secrets/tunnels/<profile>.token
```

This preserves backward compatibility while keeping new credential types organized.

## Account aliases vs Tunnel/profile aliases

These are separate namespaces. The following is valid:

```bash
cfm add company-a
cfm account add company-a
```

The first creates/uses `tunnels["company-a"]`; the second creates/uses `accounts["company-a"]`.

## Default Zone ID and automatic discovery

An Account record may store an optional `defaultZoneId`. Tunnel provisioning itself does not require a Zone ID or DNS permission.

When DNS automation is requested, Zone selection is:

```text
1. per-command --zone-id <ZONE_ID>
2. account defaultZoneId
3. automatic hostname-based Zone discovery
```

Per-command override:

```bash
cfm route add company-a project-dev \
  --hostname api-dev.example.com \
  --url http://localhost:3001 \
  --dns \
  --zone-id <ZONE_ID>
```

If neither an explicit nor default Zone ID exists, `cfm` checks the full hostname and parent domains through Cloudflare `GET /zones`. This allows accounts with multiple Zones to use the Zone that actually owns the hostname without persisting a single global default.

Automatic discovery requires `Zone:Zone:Read` for the target Zone. DNS record changes still require the appropriate DNS write permission. Users who do not grant Zone Read can continue using an explicit/default Zone ID.

## Runtime state

When `cfm start <name>` launches `cloudflared`, the CLI records lightweight state such as the PID and log path. Runtime state is local/disposable, and stale PID state is cleaned when detected.

## Logs

```text
~/.local/state/cloudflare-management/logs/<profile>.log
```

```bash
cfm logs company-a
cfm logs company-a --follow
```

Logs may include hostnames, network errors, and operational metadata. Review them before sharing publicly.

## File permissions

Configuration/secret directories use restrictive permissions. Secret files and configuration metadata are written with mode `0600` where supported.

See [Security](./SECURITY.md) for credential scope and rotation guidance.
