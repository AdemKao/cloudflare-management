<div align="center">

# ☁️ Cloudflare Management

**Manage, provision, and expose Cloudflare Tunnels across independent client accounts from one development machine.**

A lightweight CLI for developers, freelancers, and consultants who work with multiple Cloudflare accounts and want a safe, repeatable workflow around the official `cloudflared` connector and Cloudflare APIs.

[English](./README.md) · [繁體中文](./docs/README.zh-TW.md) · [日本語](./docs/README.ja.md)

[![CI](https://github.com/AdemKao/cloudflare-management/actions/workflows/ci.yml/badge.svg)](https://github.com/AdemKao/cloudflare-management/actions/workflows/ci.yml)
![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20-339933?logo=node.js&logoColor=white)
![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Linux-lightgrey)
![License](https://img.shields.io/badge/license-MIT-blue)

</div>

---

## Why this exists

Working with several companies often means several Cloudflare Accounts, domains, Tunnel tokens, API credentials, localhost ports, and connector processes.

`cfm` keeps those security boundaries separate while giving you one local workflow:

```text
Developer machine
      │
     cfm
      │
 ┌────┼───────────────┐
 ▼    ▼               ▼
A     B               C
│     │               │
Cloudflare Account A  Cloudflare Account B  Cloudflare Account C
│                     │                     │
Tunnels / routes      Tunnels / routes      Tunnels / routes
│                     │                     │
cloudflared            cloudflared            cloudflared
│                     │                     │
localhost             localhost             localhost
```

`cfm` does **not** replace `cloudflared` and does not reimplement the Tunnel protocol.

## Two operating modes

### 1. Tunnel Token mode — lowest privilege

Use an existing remotely-managed Tunnel and only store its Tunnel Token locally:

```bash
cfm add company-a
cfm start company-a
```

No Account API Token is required.

### 2. Account API mode — optional provisioning

When you want `cfm` to create/manage Cloudflare resources:

```bash
cfm account add company-a
cfm tunnel create company-a solana-dev
cfm route add company-a solana-dev \
  --hostname webhook-dev.example.com \
  --url http://localhost:3001 \
  --dns
cfm start solana-dev
```

Account API Tokens and Tunnel Tokens are stored separately.

## Highlights

- **Multi-account isolation** — different companies can use independent Account/API/Tunnel credentials.
- **Backward compatible** — existing `cfm add <profile>` users keep working after the v0.2 config migration.
- **Safe migration** — v1 metadata is backed up and migrated to schema v2 atomically and idempotently.
- **Explicit adoption** — attach an existing manual Tunnel to API management without creating a duplicate.
- **Tunnel provisioning** — list/create/show/delete remotely-managed Tunnels.
- **Published hostname management** — configure hostname → origin rules.
- **Optional DNS automation** — CNAME creation/removal only when requested and authorized.
- **One-command expose flow** — provision/reuse Tunnel + route + DNS + connector startup.
- **Protected secrets** — mode-600 token files outside the repository.
- **No raw Tunnel Token in process args** — `cloudflared tunnel run --token-file ...`.
- **Diagnostics and logs** — `doctor`, `status`, and log following.
- **No runtime npm dependencies** — Node.js 20+.

## Requirements

- macOS or Linux
- Node.js 20+
- `cloudflared` available in `PATH`
- Cloudflare account access appropriate to the mode you use

macOS:

```bash
brew install cloudflared
```

## Install

From `main`:

```bash
npm install -g github:AdemKao/cloudflare-management
```

To test the v0.2 implementation branch before merge:

```bash
npm install -g github:AdemKao/cloudflare-management#feat/v0.2-api-management
```

Verify:

```bash
cfm --version
cfm --help
```

## Quick start: existing Tunnel

Get the Tunnel Token from Cloudflare, then:

```bash
cfm init
cfm add company-a
cfm start company-a
cfm status company-a
```

See the multilingual [Tunnel Token guide](./docs/TUNNEL_TOKEN.en.md).

## Quick start: create a Tunnel from the CLI

First register a narrowly-scoped Cloudflare Account API credential:

```bash
cfm account add company-a
```

Or non-interactively:

```bash
cfm account add company-a \
  --account-id <ACCOUNT_ID> \
  --token-file ~/.secrets/company-a-api-token \
  --zone-id <OPTIONAL_DEFAULT_ZONE_ID>
```

Then create a Tunnel:

```bash
cfm tunnel create company-a solana-dev
```

Configure a published hostname:

```bash
cfm route add company-a solana-dev \
  --hostname webhook-dev.example.com \
  --url http://localhost:3001
```

Add `--dns` when the Account credential also has the required Zone DNS permission:

```bash
cfm route add company-a solana-dev \
  --hostname webhook-dev.example.com \
  --url http://localhost:3001 \
  --dns
```

Finally:

```bash
cfm start solana-dev
```

## One-command expose workflow

When the account has a default Zone ID configured:

```bash
cfm expose company-a \
  --name solana-dev \
  --hostname webhook-dev.example.com \
  --port 3001
```

The flow is:

```text
validate account credential
       ↓
reuse adopted/provisioned Tunnel
or create one if no local profile exists
       ↓
configure hostname → origin
       ↓
manage DNS unless --no-dns
       ↓
start cloudflared unless --no-start
       ↓
print public URL/status
```

`cfm expose` does not silently adopt a token-only profile. Adopt it explicitly first.

## Existing v0.1 users

Suppose you already used:

```bash
cfm add company-a
```

After upgrading, this still works immediately:

```bash
cfm start company-a
cfm status company-a
cfm logs company-a
```

The profile is migrated as:

```text
managementMode: token-only
account: null
tunnelId: null
existing tokenFile path preserved
```

If you later want API management for that same existing remote Tunnel:

```bash
cfm account add company-a
cfm tunnel adopt company-a company-a
```

When automatic matching is ambiguous, specify the remote Tunnel explicitly:

```bash
cfm tunnel adopt company-a company-a \
  --tunnel-id <TUNNEL_UUID>
```

Adoption does not create another Tunnel and does not replace the existing Tunnel Token by default.

## Command overview

| Area | Commands |
| --- | --- |
| Local profiles | `init`, `add`, `remove`, `list` |
| Connector process | `start`, `stop`, `restart`, `start-all`, `stop-all`, `status`, `logs`, `doctor` |
| Accounts | `account add/list/show/doctor/remove` |
| Tunnels | `tunnel list/create/adopt/show/token/delete` |
| Routes | `route list/add/remove` |
| Orchestration | `expose` |

Read the complete [Command Reference](./docs/COMMANDS.md).

## Security model

Secrets are separated by purpose:

```text
~/.config/cloudflare-management/
├── config.json
└── secrets/
    ├── company-a.token                 # legacy/token-only path preserved
    ├── accounts/
    │   └── company-a.api-token
    └── tunnels/
        └── solana-dev.token
```

Runtime data:

```text
~/.local/state/cloudflare-management/
├── logs/
└── runtime/
```

Key rules:

- API Tokens and Tunnel Tokens are distinct credentials.
- Secret files are mode `0600`.
- Raw credentials are not stored in `config.json`.
- Normal commands do not print raw tokens.
- Remote Tunnel deletion requires confirmation or `--yes`.
- Use a specific Account and specific Zone scope instead of broad cross-client credentials.

Read [Security](./docs/SECURITY.md) for the full model.

## Documentation

- [Documentation index](./docs/README.md)
- [English guide](./docs/README.en.md)
- [繁體中文](./docs/README.zh-TW.md)
- [日本語](./docs/README.ja.md)
- [Tunnel Token guide](./docs/TUNNEL_TOKEN.en.md)
- [Architecture](./docs/ARCHITECTURE.md)
- [v0.2 API design](./docs/V0.2_API_MANAGEMENT.md)
- [Command Reference](./docs/COMMANDS.md)
- [Configuration](./docs/CONFIGURATION.md)
- [Security](./docs/SECURITY.md)
- [Troubleshooting](./docs/TROUBLESHOOTING.md)
- [Roadmap](./docs/ROADMAP.md)

## Development

```bash
git clone https://github.com/AdemKao/cloudflare-management.git
cd cloudflare-management
npm link
npm run check
```

The test suite includes migration, backward-compatibility, Cloudflare API error-path, secret-leakage, alias coexistence, duplicate-prevention, and adoption tests using mocked API responses.

## Scope

`cfm` is intentionally a focused Cloudflare Tunnel workflow tool, not a general-purpose Cloudflare administration CLI.

Cloudflare remains the source of truth for Accounts, Zones, Tunnels, remote configuration, DNS, Access policies, and credential issuance/revocation.

## License

[MIT](./LICENSE) © 2026 Adem Kao
