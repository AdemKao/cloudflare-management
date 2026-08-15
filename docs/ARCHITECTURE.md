# Architecture

[English README](./README.en.md) · [繁體中文 README](./README.zh-TW.md) · [日本語 README](./README.ja.md)

## Goal

`cloudflare-management` is intentionally a thin local process manager around Cloudflare's remotely-managed Tunnel model. It does not reimplement Cloudflare Tunnel and it does not need account-wide Cloudflare API credentials for the v0.1 workflow.

The main design goal is safe isolation when one development machine works with multiple independent client/company Cloudflare accounts.

## High-level architecture

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

## Responsibility boundaries

### Cloudflare Dashboard

Cloudflare remains the source of truth for:

- Tunnel creation
- Tunnel ownership
- Account/domain ownership
- Published Application hostnames
- DNS routing
- Origin/service routing
- Tunnel token rotation and revocation

### `cfm`

The CLI is responsible only for local developer-machine concerns:

- Profile metadata
- Local token-file storage
- Starting a `cloudflared` connector
- Stopping/restarting a connector
- PID/runtime state
- Connector logs
- Diagnostics

### `cloudflared`

`cloudflared` remains responsible for the actual Cloudflare Tunnel connection. `cfm` launches it using a token file rather than implementing the Tunnel protocol itself.

## Local storage

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

## Profile model

A profile represents one local connector/security boundary, normally one company or client Cloudflare account.

Example logical model:

```json
{
  "name": "company-a",
  "tokenFile": "~/.config/cloudflare-management/secrets/company-a.token"
}
```

Hostnames and localhost ports intentionally remain in Cloudflare's remotely-managed Tunnel configuration in v0.1. This keeps client routing configuration in the Cloudflare account that owns it.

## Process lifecycle

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

## Why one profile per client/security boundary

Different companies may have different:

- Cloudflare Accounts
- Domains
- Access policies
- Team members
- Contractual/security requirements
- Offboarding timelines

Keeping separate Tunnel tokens and connector processes avoids coupling unrelated clients and makes revocation/offboarding much safer.

## Future extensions

Possible future versions may add optional capabilities such as:

- Cloudflare API integration for Tunnel/route provisioning
- Profile aliases and project metadata
- Hostname/localhost health checks
- Shell completion
- Background service installation (launchd/systemd)
- Encrypted secret backends such as macOS Keychain or 1Password
- Config import/export without secret material

These should remain optional so the basic CLI can continue operating with minimum Cloudflare privileges.
