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
cfm tunnel create company-a project-dev
cfm route add company-a project-dev \
  --hostname api-dev.example.com \
  --url http://localhost:3001 \
  --dns
cfm start project-dev
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
- **Automatic Zone discovery** — when `--dns` is used without a Zone ID, `cfm` can resolve the matching Cloudflare Zone from the hostname.
- **Permission-aware diagnostics** — v0.2.2 distinguishes Tunnel access from Zone/DNS access and recognizes Cloudflare error code `10000`.
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

Install the latest version from `main`:

```bash
npm install -g github:AdemKao/cloudflare-management
```

Install a specific release tag:

```bash
npm install -g github:AdemKao/cloudflare-management#v0.2.2
```

Verify:

```bash
cfm --version
cfm --help
```

## Update

If `cfm` was installed directly from GitHub, update by reinstalling from `main`:

```bash
npm install -g github:AdemKao/cloudflare-management
cfm --version
```

To upgrade to a specific release instead:

```bash
npm install -g github:AdemKao/cloudflare-management#v0.2.2
cfm --version
```

Your profiles, Account API Tokens, Tunnel Tokens, runtime state, and logs live outside the npm package directory, so reinstalling/updating the CLI does not remove them.

When upgrading from v0.1 to v0.2, the first config load automatically backs up the v1 metadata and migrates existing profiles to `token-only` records while preserving the existing Tunnel Token paths.

Read the multilingual [Upgrade guide](./docs/UPGRADING.en.md) before upgrading production/dev machines with important client profiles.

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
cfm tunnel create company-a project-dev
```

Configure a published hostname:

```bash
cfm route add company-a project-dev \
  --hostname api-dev.example.com \
  --url http://localhost:3001
```

Add `--dns` when the Account credential also has the required Zone DNS permission:

```bash
cfm route add company-a project-dev \
  --hostname api-dev.example.com \
  --url http://localhost:3001 \
  --dns
```

When `--dns` is enabled, Zone selection follows this order:

```text
1. --zone-id <ZONE_ID>
2. account defaultZoneId
3. automatic discovery from the hostname
```

Automatic discovery queries Cloudflare Zones from the full hostname toward parent domains (for example `api-dev.example.com` → `example.com`). It requires Zone read access for the target Zone. DNS record creation/update separately requires DNS edit access. If you intentionally do not grant Zone Read, provide `--zone-id <ZONE_ID>` explicitly.

Cloudflare can return API error code `10000` (`Authentication error`) even when the HTTP status is 200. `cfm` v0.2.2 recognizes that response and explains whether the failure happened during Zone discovery or DNS record management.

### Check permissions before changing DNS

Basic doctor validates Tunnel API access only:

```bash
cfm account doctor company-a
```

To additionally validate Zone discovery and DNS-read access for a hostname without mutating DNS:

```bash
cfm account doctor company-a \
  --hostname api-dev.example.com
```

If you already know the Zone ID:

```bash
cfm account doctor company-a \
  --hostname api-dev.example.com \
  --zone-id <ZONE_ID>
```

A successful read-only doctor does not prove DNS write permission; `cfm route ... --dns` still requires DNS edit access for the target Zone.

Finally:

```bash
cfm start project-dev
```

## One-command expose workflow

`cfm expose` uses the same Zone selection rules, so a default Zone ID is no longer required when the API Token can discover the target Zone:

```bash
cfm expose company-a \
  --name project-dev \
  --hostname api-dev.example.com \
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
resolve Zone ID (explicit/default/discovered)
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
        └── project-dev.token
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
- Grant Zone Read only when you want automatic Zone discovery; otherwise use an explicit/default Zone ID.
- DNS automation still requires DNS Edit on the target Zone even when Tunnel API checks succeed.

Read [Security](./docs/SECURITY.md) for the full model.

## Documentation

- [Documentation index](./docs/README.md)
- [English guide](./docs/README.en.md)
- [繁體中文](./docs/README.zh-TW.md)
- [日本語](./docs/README.ja.md)
- [Upgrade guide](./docs/UPGRADING.en.md)
- [Tunnel Token guide](./docs/TUNNEL_TOKEN.en.md)
- [Architecture](./docs/ARCHITECTURE.md)
- [v0.2 API design](./docs/V0.2_API_MANAGEMENT.md)
- [Command Reference](./docs/COMMANDS.md)
- [Configuration](./docs/CONFIGURATION.md)
- [Security](./docs/SECURITY.md)
- [Troubleshooting](./docs/TROUBLESHOOTING.md)
- [Roadmap](./docs/ROADMAP.md)
- [Changelog](./CHANGELOG.md)

## Development

```bash
git clone https://github.com/AdemKao/cloudflare-management.git
cd cloudflare-management
npm link
npm run check
```

The test suite includes migration, backward-compatibility, Cloudflare API error paths, secret-leakage checks, alias coexistence, duplicate prevention, adoption, automatic Zone discovery, code-10000 authorization handling, and permission diagnostics using mocked API responses.

## Scope

`cfm` is intentionally a focused Cloudflare Tunnel workflow tool, not a general-purpose Cloudflare administration CLI.

Cloudflare remains the source of truth for Accounts, Zones, Tunnels, remote configuration, DNS, Access policies, and credential issuance/revocation.

## License

[MIT](./LICENSE) © 2026 Adem Kao
