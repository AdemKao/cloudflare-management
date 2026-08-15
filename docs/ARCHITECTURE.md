# Architecture

[English README](./README.en.md) · [繁體中文 README](./README.zh-TW.md) · [日本語 README](./README.ja.md)

## Goal

`cloudflare-management` is intentionally a thin management layer around Cloudflare's remotely-managed Tunnel model and the official `cloudflared` connector.

The main design goal is safe isolation when one development machine works with multiple independent client/company Cloudflare accounts.

v0.1 is a local connector manager that needs only a Tunnel-specific token. v0.2 is planned to add an **optional** Cloudflare API mode for Account/Tunnel/route provisioning while preserving the v0.1 low-privilege workflow.

## v0.1 high-level architecture

```text
Developer Mac
    │
    ├── cfm profile: company-a
    │      ├── local token file
    │      └── cloudflared process
    │                 │
    │                 ▼
    │          Cloudflare Account A
    │          company-a-dev Tunnel
    │                 │
    │          api-dev.company-a.com
    │                 │
    │                 ▼
    │          localhost:3001
    │
    ├── cfm profile: company-b
    │      ├── local token file
    │      └── cloudflared process
    │                 │
    │                 ▼
    │          Cloudflare Account B
    │          company-b-dev Tunnel
    │                 │
    │          hook-dev.company-b.com
    │                 │
    │                 ▼
    │          localhost:4001
    │
    └── cfm profile: company-c
           ├── local token file
           └── cloudflared process
                      │
                      ▼
               Cloudflare Account C
```

## Responsibility boundaries in v0.1

### Cloudflare Dashboard / API

Cloudflare remains the source of truth for:

- Tunnel creation;
- Tunnel ownership;
- Account/domain ownership;
- Published Application hostnames;
- DNS routing;
- origin/service routing;
- Tunnel Token rotation and revocation.

### `cfm`

The v0.1 CLI is responsible for local developer-machine concerns:

- profile metadata;
- local Tunnel Token file storage;
- starting a `cloudflared` connector;
- stopping/restarting a connector;
- PID/runtime state;
- connector logs;
- diagnostics.

### `cloudflared`

`cloudflared` remains responsible for the actual Cloudflare Tunnel connection. `cfm` launches it using a token file rather than implementing the Tunnel protocol itself.

## Local storage in v0.1

```text
~/.config/cloudflare-management/
├── config.json
└── secrets/
    ├── company-a.token
    ├── company-b.token
    └── company-c.token

~/.local/state/cloudflare-management/
├── logs/
│   ├── company-a.log
│   ├── company-b.log
│   └── company-c.log
└── runtime/
    ├── company-a.json
    ├── company-b.json
    └── company-c.json
```

`XDG_CONFIG_HOME` and `XDG_STATE_HOME` override the default locations when configured.

## v0.1 profile model

A profile represents one local connector/security boundary, normally one company or client Cloudflare account.

Example logical model:

```json
{
  "name": "company-a",
  "tokenFile": "~/.config/cloudflare-management/secrets/company-a.token"
}
```

Hostnames and localhost ports intentionally remain in Cloudflare's remotely-managed Tunnel configuration in v0.1.

## v0.1 process lifecycle

```text
cfm start company-a
        │
        ├── validate profile
        ├── validate token file
        ├── validate cloudflared exists
        ├── detect existing process
        │
        ▼
cloudflared tunnel run --token-file <company-a.token>
        │
        ├── PID/runtime metadata
        └── log output
```

`cfm stop`, `restart`, `status`, and `logs` operate on this locally tracked connector process.

## Why one security boundary per client

Different companies may have different:

- Cloudflare Accounts;
- domains;
- Access policies;
- team members;
- contractual/security requirements;
- offboarding timelines.

Keeping separate credentials and connector processes avoids coupling unrelated clients and makes revocation/offboarding safer.

## Planned v0.2 architecture

Tracking issue: #3

v0.2 introduces an optional Account API mode with a richer domain model:

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

The v0.1 Tunnel Token mode remains valid and should not require an Account-level API Token.

### v0.2 component boundaries

```text
cfm
├── CLI command layer
│
├── application/use-case layer
│   ├── accounts
│   ├── tunnels
│   └── routes
│
├── Cloudflare API adapter
│   ├── account verification
│   ├── tunnel provisioning
│   ├── remote tunnel configuration
│   └── optional DNS operations
│
├── local config + secret storage
│
└── connector process manager
        │
        ▼
   cloudflared
        │
        ▼
Cloudflare Tunnel
```

Cloudflare API HTTP details should not be mixed directly into CLI command handlers. Commands should orchestrate application use cases; the Cloudflare adapter should own request/response handling and error normalization.

### v0.2 credential model

Two credential types must remain distinct.

#### Account API Token

Used only when provisioning or managing Cloudflare resources through API mode.

Expected scope for Tunnel provisioning:

```text
Account → Cloudflare Tunnel → Edit
```

Optional DNS automation additionally requires:

```text
Zone → DNS → Edit
```

The token should be restricted to the specific client Account and required Zone(s).

#### Tunnel Token

Used by `cloudflared` to run one remotely-managed Tunnel.

This remains the preferred credential for users who only need local connector execution.

### Proposed v0.2 storage model

```text
~/.config/cloudflare-management/
├── config.json
└── secrets/
    ├── accounts/
    │   ├── company-a.api-token
    │   └── company-b.api-token
    └── tunnels/
        ├── solana-dev.token
        └── webhook-dev.token
```

Logical schema:

```json
{
  "version": 2,
  "accounts": {
    "company-a": {
      "accountId": "ACCOUNT_ID",
      "apiTokenFile": "~/.config/cloudflare-management/secrets/accounts/company-a.api-token",
      "defaultZoneId": "ZONE_ID"
    }
  },
  "tunnels": {
    "solana-dev": {
      "account": "company-a",
      "tunnelId": "TUNNEL_UUID",
      "tokenFile": "~/.config/cloudflare-management/secrets/tunnels/solana-dev.token"
    }
  }
}
```

Existing v0.1 configuration must migrate safely and idempotently to schema v2.

### Planned v0.2 workflow

```text
cfm account add company-a
        │
        ├── capture Account ID
        ├── capture scoped API Token
        └── verify credential
        │
        ▼
cfm tunnel create company-a solana-dev
        │
        ├── call Cloudflare Tunnel API
        ├── persist Tunnel ID
        └── persist Tunnel Token securely
        │
        ▼
cfm route add company-a solana-dev
        │
        ├── configure hostname → origin
        └── optionally manage DNS
        │
        ▼
cfm start solana-dev
        │
        ▼
cloudflared tunnel run --token-file ...
```

A future `cfm expose` command may compose those steps but should be implemented only after the lower-level commands are stable.

## Architecture rules for v0.2

- Account API mode is optional.
- Existing `cfm add/start/stop/status/logs` workflows remain backward compatible.
- API Tokens and Tunnel Tokens are stored separately.
- No secret may be printed in logs or command output.
- Do not use one unrestricted credential across unrelated clients.
- Destructive Cloudflare operations require explicit confirmation.
- `cfm` does not reimplement `cloudflared` or the Tunnel protocol.
- Cloudflare remains the source of truth for remote resources.
- DNS automation must remain optional so Tunnel creation does not require DNS permission.

See [v0.2 API Management Design](./V0.2_API_MANAGEMENT.md) for command design, migration, security, failure handling, and implementation phases.

## Other future extensions

Possible future versions may also add:

- project aliases and metadata;
- hostname/localhost health checks;
- shell completion;
- background service installation (`launchd`/`systemd`);
- encrypted secret backends such as macOS Keychain or 1Password;
- config import/export without secret material;
- JSON output for automation.

These should remain optional so the basic CLI can continue operating with minimum Cloudflare privileges.
