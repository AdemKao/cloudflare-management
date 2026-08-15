# Architecture

[English README](./README.en.md) · [繁體中文 README](./README.zh-TW.md) · [日本語 README](./README.ja.md)

## Goal

`cloudflare-management` is a thin management layer around Cloudflare's remotely-managed Tunnel APIs and the official `cloudflared` connector.

The main design goal is safe isolation when one development machine works with multiple independent client/company Cloudflare Accounts.

## Resource model

```text
Account
  │
  └── Tunnel
       │
       ├── Route / Published Application
       │
       └── Connector
            └── local cloudflared process
```

The token-only workflow remains a supported low-privilege mode where a Tunnel is intentionally not attached to an Account API credential.

## v0.3 component model

```text
cfm
├── CLI command layer
│   ├── operational commands
│   ├── migrate
│   └── upgrade
│
├── config / migration
│   ├── schema v3
│   ├── v1/v2 metadata backups
│   ├── recoverable credential relocation
│   └── atomic config persistence
│
├── account-scoped credential storage
│   ├── accounts/<account>/api-token
│   ├── accounts/<account>/tunnels/*.token
│   └── legacy/tunnels/*.token
│
├── resource services
│   ├── Accounts
│   ├── Tunnels
│   ├── adoption
│   ├── routes
│   ├── DNS
│   └── expose orchestration
│
├── Cloudflare API adapter
│   ├── Tunnel API
│   ├── remote Tunnel config
│   ├── Zone/DNS API
│   └── normalized auth/errors/timeouts
│
├── installer adapter
│   ├── npm + GitHub Release/main
│   └── Homebrew adapter for a future formula
│
└── local process manager
    ├── cloudflared start / stop / restart
    ├── PID state
    ├── logs
    └── diagnostics
```

Cloudflare remains the source of truth for Account/Zone ownership, remote Tunnel objects, remote configuration, DNS, Access policies, and credential issuance/revocation.

## Credential modes and storage boundaries

### Token-only

```text
existing remote Tunnel
        │
        ▼
Tunnel Token
        │
        ▼
cfm add <profile>
        │
        ▼
legacy/tunnels/<profile>.token
```

No Account API Token is required.

### Account API mode

```text
Cloudflare Account
        │
        ▼
accounts/<account>/
├── api-token
└── tunnels/
    ├── tunnel-a.token
    └── tunnel-b.token
```

API-managed Tunnel credentials are physically grouped under the Account alias that owns them.

## Management states

```text
token-only
  Existing/manual Tunnel known locally by Tunnel Token but not bound to an Account.

adopted
  Existing/manual Tunnel explicitly attached to an Account alias + remote Tunnel ID.

provisioned
  Tunnel created by cfm through Cloudflare API mode.
```

These states prevent `cfm` from silently replacing or duplicating an existing remote Tunnel.

## Schema v3 migration

v0.3 migrates v1/v2 directly to v3.

Conceptual v0.2 storage:

```text
secrets/
├── company-a.token
├── accounts/company-a.api-token
└── tunnels/project-dev.token
```

v0.3 target:

```text
accounts/company-a/
├── api-token
└── tunnels/project-dev.token

legacy/tunnels/company-a.token
```

Flow:

```text
read v1/v2 metadata
      │
      ├── validate aliases/paths
      ├── compute relocation plan
      ├── reject conflicting destination secrets
      ├── create version-specific metadata backup
      ├── move credentials
      ├── recover if a previous move already completed
      │
      ▼
atomic schema-v3 config write
      │
      ▼
cleanup empty old secret directories
```

### Migration invariants

- credential values are preserved;
- Account/profile aliases are preserved;
- a destination with different bytes is never overwritten;
- source-missing + destination-existing is treated as a recoverable partial migration;
- config replacement is atomic;
- running migration again after success is a no-op;
- token-only profiles stay unbound under `legacy/tunnels/`.

Preview:

```bash
cfm migrate --dry-run
```

## Alias namespaces

Account aliases and Tunnel/profile aliases are separate namespaces, so this is valid:

```bash
cfm add company-a
cfm account add company-a
```

Internally they are separate resources until explicit adoption.

## Adoption

```text
token-only profile
legacy/tunnels/company-a.token
      │
      ├── validate Account API credential
      ├── resolve exact remote Tunnel
      ├── reject duplicate local attachment
      ├── safely move existing Token file
      │
      ▼
adopted profile
accounts/company-a/tunnels/company-a.token
```

Adoption preserves the Token value and never creates a remote Tunnel.

## Tunnel provisioning

```text
cfm tunnel create <account> <name>
        │
        ├── ensure local name is unused
        ├── create remotely-managed Tunnel
        ├── retrieve Tunnel Token
        ├── write accounts/<account>/tunnels/<name>.token
        ├── persist Account alias + Tunnel ID
        │
        ▼
provisioned profile
```

If token retrieval/local persistence fails, the create flow attempts to roll back the newly created remote Tunnel.

## Route and DNS model

```text
api-dev.example.com
        │
        ▼
http://localhost:3001
```

`cfm route add` updates the remote Tunnel ingress config. DNS is optional:

```bash
cfm route add ...
cfm route add ... --dns
```

Zone selection:

```text
explicit --zone-id
      ↓
account defaultZoneId
      ↓
hostname-based discovery
```

Tunnel permission, Zone Read, and DNS Edit are intentionally diagnosed as separate capabilities.

## `cfm expose` orchestration

```text
cfm expose <account> --name <tunnel> --hostname <host> --port <port>
        │
        ├── reuse adopted/provisioned profile
        ├── create only when no local profile exists
        ├── refuse silent token-only adoption
        ├── configure route
        ├── configure DNS unless --no-dns
        ├── start connector unless --no-start
        │
        ▼
public URL/status
```

## Self-upgrade architecture

`cfm upgrade` is separated from resource/config logic by an installer abstraction.

Current stable npm/GitHub path:

```text
cfm upgrade
    │
    ├── detect npm-managed global install
    ├── GET latest GitHub Release metadata
    ├── build npm argument array pinned to vX.Y.Z
    ├── preview/perform current storage migration
    ├── npm install -g github:...#vX.Y.Z
    └── invoke new `cfm migrate`
```

The updater uses `spawn`/`execFile` argument arrays with `shell: false`; it does not build a shell command from user-controlled strings.

Unknown/manual/development installs are not guessed. They receive a manual update command instead of automatic replacement.

A Homebrew adapter is present so a future formula can use `brew upgrade cloudflare-management`; the adapter does not imply a formula is currently published.

## Runtime state

Credential storage is config-scoped; process state remains separate:

```text
~/.local/state/cloudflare-management/
├── logs/
└── runtime/
```

A credential relocation does not change the profile alias used by `start`, `status`, or `logs`.

## Architecture rules

- Account API mode remains optional.
- Existing connector/profile aliases remain backward compatible.
- API Tokens and Tunnel Tokens are separate credential types.
- API-managed Tunnel credentials belong to exactly one Account storage boundary.
- Token-only profiles remain unbound until explicit adoption.
- Raw credentials are not stored in metadata or normal command output.
- Migration never overwrites a different destination credential.
- Remote destructive operations require explicit confirmation.
- DNS automation is optional and separately authorized.
- Self-update does not shell-interpolate commands or guess unknown installs.
- `cfm` does not implement the Tunnel protocol; `cloudflared` remains responsible for connectivity.

See [Configuration](./CONFIGURATION.md), [Security](./SECURITY.md), [Command Reference](./COMMANDS.md), and [Upgrading](./UPGRADING.en.md).
