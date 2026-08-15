# Architecture

[English README](./README.en.md) · [繁體中文 README](./README.zh-TW.md) · [日本語 README](./README.ja.md)

## Goal

`cloudflare-management` is a thin management layer around Cloudflare's remotely-managed Tunnel APIs and the official `cloudflared` connector.

The main design goal is safe isolation when one development machine works with multiple independent client/company Cloudflare accounts.

## Resource model

v0.2 uses explicit resource boundaries:

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

The original v0.1 Tunnel Token workflow remains a supported low-privilege mode.

## Components

```text
cfm
├── CLI command layer
│
├── config / migration
│   ├── schema v2
│   ├── v1 backup
│   └── atomic persistence
│
├── secret storage
│   ├── Account API Tokens
│   └── Tunnel Tokens
│
├── application/resource services
│   ├── Accounts
│   ├── Tunnels
│   ├── adoption
│   ├── routes
│   ├── DNS
│   └── expose orchestration
│
├── Cloudflare API adapter
│   ├── authentication
│   ├── Tunnel API
│   ├── remote Tunnel configuration
│   ├── DNS API
│   └── normalized errors/timeouts
│
└── local process manager
    ├── start / stop / restart
    ├── PID state
    ├── logs
    └── diagnostics
         │
         ▼
    cloudflared
         │
         ▼
  Cloudflare Tunnel
```

Cloudflare remains the source of truth for Account/Zone ownership, remote Tunnel objects, remote configuration, DNS, Access policies, and credential issuance/revocation.

## Two credential modes

### Tunnel Token mode

```text
existing Cloudflare Tunnel
        │
        ▼
Tunnel Token
        │
        ▼
cfm add <profile>
        │
        ▼
cloudflared --token-file ...
```

No Account API Token is required.

### Account API mode

```text
Cloudflare Account API Token
        │
        ▼
cfm account add <alias>
        │
        ├── Tunnel create/list/show/delete
        ├── route configuration
        └── optional DNS mutation
```

The Account API Token is the higher-privilege credential and is kept separate from Tunnel connector credentials.

## Management states

A local Tunnel profile has one of three management states:

```text
token-only
  Existing/manual Tunnel known locally by Tunnel Token.

adopted
  Existing/manual Tunnel explicitly attached to an Account alias + Tunnel ID.

provisioned
  Tunnel created by cfm through Cloudflare API mode.
```

This state is important because `cfm` must not infer that a token-only profile should be replaced or duplicated.

## v1 → v2 migration

A v0.1 config may look conceptually like:

```json
{
  "version": 1,
  "tunnels": {
    "company-a": {
      "tokenFile": "~/.config/cloudflare-management/secrets/company-a.token"
    }
  }
}
```

The migration process is:

```text
read v1 config
      │
      ├── create metadata backup
      ├── preserve profile name
      ├── preserve existing tokenFile path/value
      │
      ▼
write schema v2 atomically
      │
      ▼
company-a = token-only
```

Resulting logical metadata:

```json
{
  "version": 2,
  "accounts": {},
  "tunnels": {
    "company-a": {
      "managementMode": "token-only",
      "account": null,
      "tunnelId": null,
      "tokenFile": "~/.config/cloudflare-management/secrets/company-a.token"
    }
  }
}
```

Migration is idempotent. Existing secret files are not moved merely to normalize directory structure.

## Alias namespaces

Account aliases and Tunnel/profile aliases are separate namespaces.

This is valid:

```bash
cfm add company-a
cfm account add company-a
```

Internally:

```text
accounts["company-a"]
tunnels["company-a"]
```

They represent different resources.

## Adoption

An existing token-only profile can opt into API management:

```bash
cfm account add company-a
cfm tunnel adopt company-a company-a
```

Flow:

```text
token-only profile
      │
      ├── verify Account credential
      ├── resolve existing remote Tunnel
      ├── reject duplicate local attachment
      ├── preserve current Tunnel Token file
      │
      ▼
adopted profile
```

When remote name matching is not unique, use an explicit Tunnel ID:

```bash
cfm tunnel adopt company-a company-a --tunnel-id <TUNNEL_UUID>
```

Adoption never creates a remote Tunnel.

## Tunnel provisioning

```text
cfm tunnel create <account> <name>
        │
        ├── ensure local profile name is unused
        ├── Cloudflare create remotely-managed Tunnel
        ├── retrieve Tunnel Token
        ├── store token with mode 0600
        ├── persist Tunnel ID + Account alias
        │
        ▼
provisioned profile
```

If token retrieval/local persistence fails, the create flow attempts to roll back the newly-created remote Tunnel.

## Route and DNS model

A route maps a published hostname to an origin:

```text
webhook-dev.example.com
          │
          ▼
http://localhost:3001
```

`cfm route add` updates the remotely-managed Tunnel ingress configuration and preserves a catch-all rule.

DNS is optional:

```bash
cfm route add ...                # route only
cfm route add ... --dns          # route + DNS CNAME
```

A default Zone ID may be attached to an Account alias or overridden per command.

## `cfm expose` orchestration

```text
cfm expose <account> --name <tunnel> --hostname <host> --port <port>
        │
        ├── load Account
        ├── reuse adopted/provisioned profile when present
        ├── create a Tunnel only if no local profile exists
        ├── refuse silent use of token-only profiles
        ├── configure route
        ├── configure DNS unless --no-dns
        ├── start connector unless --no-start
        │
        ▼
public URL/status
```

If a new Tunnel was created by this convenience flow and route/DNS provisioning fails, `cfm` attempts to roll back that newly-created Tunnel. If only local connector startup fails, already-provisioned remote resources are retained for diagnosis/retry.

## Local storage

```text
~/.config/cloudflare-management/
├── config.json
├── config.v1.backup.json        # created only when migrating v1
└── secrets/
    ├── company-a.token          # existing/token-only path can remain here
    ├── accounts/
    │   ├── company-a.api-token
    │   └── company-b.api-token
    └── tunnels/
        ├── solana-dev.token
        └── webhook-dev.token

~/.local/state/cloudflare-management/
├── logs/
└── runtime/
```

`XDG_CONFIG_HOME` and `XDG_STATE_HOME` are respected.

## Process lifecycle

```text
cfm start <profile>
        │
        ├── validate local profile
        ├── validate token file
        ├── validate cloudflared exists
        ├── detect existing PID
        │
        ▼
cloudflared tunnel run --token-file <path>
        │
        ├── detached process
        ├── runtime PID metadata
        └── connector log
```

The API layer is not involved when an existing local connector is simply started/stopped.

## Architecture rules

- Account API mode is optional.
- Existing v0.1 connector commands remain supported.
- API Tokens and Tunnel Tokens are separate secret types.
- Raw secrets are not stored in config metadata or normal command output.
- One unrestricted credential must not be shared across unrelated clients.
- Remote destructive operations require explicit confirmation.
- Token-only profiles are never silently adopted.
- `cfm` does not implement the Tunnel protocol; `cloudflared` remains responsible for connectivity.
- DNS automation is optional and requires explicit permission.

See [Security](./SECURITY.md), [Command Reference](./COMMANDS.md), and [v0.2 API Management](./V0.2_API_MANAGEMENT.md).
