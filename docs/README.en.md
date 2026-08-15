<div align="center">

# ☁️ Cloudflare Management

**Manage, provision, and expose Cloudflare Tunnels across independent client accounts from one development machine.**

A lightweight CLI for developers, freelancers, and consultants who work with multiple Cloudflare accounts and want a safe, repeatable workflow around the official `cloudflared` connector and Cloudflare APIs.

**English** · [繁體中文](./README.zh-TW.md) · [日本語](./README.ja.md) · [Root README](../README.md)

[![CI](https://github.com/AdemKao/cloudflare-management/actions/workflows/ci.yml/badge.svg)](https://github.com/AdemKao/cloudflare-management/actions/workflows/ci.yml)
![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20-339933?logo=node.js&logoColor=white)
![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Linux-lightgrey)
![License](https://img.shields.io/badge/license-MIT-blue)

</div>

---

> This localized guide follows the same information architecture as the root README so install, upgrade, security, and Quick Start content stay synchronized.

## Why this exists

Working with several companies often means several Cloudflare Accounts, domains, Tunnel Tokens, API credentials, localhost ports, and connector processes.

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

```bash
cfm add company-a
cfm start company-a
```

No Account API Token is required. In v0.3, unbound token-only profiles live under `legacy/tunnels/` until explicit adoption.

### 2. Account API mode — optional provisioning

```bash
cfm account add company-a
cfm tunnel create company-a project-dev
cfm route add company-a project-dev \
  --hostname api-dev.example.com \
  --url http://localhost:3001 \
  --dns
cfm start project-dev
```

Account API Tokens and Tunnel Tokens are stored separately and grouped under the owning Account directory.

## Highlights

- **Multi-account isolation** with one local credential boundary per Account.
- **Account-scoped storage** under `accounts/<account>/`.
- **Backward compatibility** for v0.1/v0.2 profile aliases.
- **Safe schema v3 migration** with backups, recovery, and conflict protection.
- **Migration preview** through `cfm migrate --dry-run`.
- **Self-upgrade** through `cfm upgrade` starting in v0.3.
- **Installer abstraction** for the current npm/GitHub distribution and future Homebrew formula support.
- **Explicit adoption** without creating duplicate remote Tunnels.
- **Tunnel provisioning**, hostname routes, optional DNS automation, and Zone discovery.
- **Permission-aware diagnostics** for Tunnel vs Zone/DNS access.
- **One-command `cfm expose`** workflow.
- **Mode-`0600` credentials** and no raw Tunnel Token in process args.
- **No runtime npm dependencies**.

## Requirements

- macOS or Linux
- Node.js 20+
- `cloudflared` in `PATH`
- Cloudflare access appropriate to the selected mode

macOS:

```bash
brew install cloudflared
```

## Install

Latest from `main`:

```bash
npm install -g github:AdemKao/cloudflare-management
```

v0.3.0 release:

```bash
npm install -g github:AdemKao/cloudflare-management#v0.3.0
```

Verify:

```bash
cfm --version
cfm --help
```

> Homebrew distribution is planned. The v0.3 updater includes a Homebrew adapter, but that does not mean a formula/tap is already published.

## Update

### Bootstrap once from v0.2.x

```bash
npm install -g github:AdemKao/cloudflare-management#v0.3.0
cfm --version
cfm migrate --dry-run
cfm migrate
```

### v0.3 and later

```bash
cfm upgrade
```

Preview:

```bash
cfm upgrade --dry-run
```

Non-interactive confirmation:

```bash
cfm upgrade --yes
```

Development channel:

```bash
cfm upgrade --channel main
```

For the current npm/GitHub distribution, the stable channel resolves and installs the latest GitHub Release tag. The updater uses argument arrays instead of shell interpolation and invokes `cfm migrate` after a successful package update.

Read [Upgrading](./UPGRADING.en.md) before changing an important development machine.

## v0.3 account-scoped storage

```text
~/.config/cloudflare-management/
├── config.json
├── backups/
│   ├── config.v1.backup.json
│   └── config.v2.backup.json
├── accounts/
│   ├── company-a/
│   │   ├── api-token
│   │   └── tunnels/
│   │       └── project-dev.token
│   └── company-b/
│       ├── api-token
│       └── tunnels/
└── legacy/
    └── tunnels/
        └── unbound-profile.token
```

API-managed Tunnel credentials live under the Account that owns them. Unbound token-only profiles remain in `legacy/tunnels/`.

## Safe migration from v0.1 / v0.2

```bash
cfm migrate --dry-run
cfm migrate
```

Migration preserves aliases and credential values while changing file paths. It writes a version-specific metadata backup before replacing the old config, can recover after a partial relocation, and refuses to overwrite a destination credential whose contents differ.

Existing profile commands remain unchanged:

```bash
cfm start company-a
cfm status company-a
cfm logs company-a
```

## Quick start: existing Tunnel

```bash
cfm init
cfm add company-a
cfm start company-a
cfm status company-a
```

Token-only credential:

```text
legacy/tunnels/company-a.token
```

See [Tunnel Token setup](./TUNNEL_TOKEN.en.md).

## Quick start: create a Tunnel from the CLI

```bash
cfm account add company-a
cfm tunnel create company-a project-dev
```

Storage becomes:

```text
accounts/company-a/
├── api-token
└── tunnels/
    └── project-dev.token
```

Route only:

```bash
cfm route add company-a project-dev \
  --hostname api-dev.example.com \
  --url http://localhost:3001
```

Route plus DNS:

```bash
cfm route add company-a project-dev \
  --hostname api-dev.example.com \
  --url http://localhost:3001 \
  --dns
```

Zone resolution order:

```text
1. --zone-id <ZONE_ID>
2. account defaultZoneId
3. hostname-based discovery
```

Automatic discovery requires Zone Read; DNS mutation separately requires DNS Edit/Write.

### Permission diagnostics

```bash
cfm account doctor company-a
```

Basic doctor checks Tunnel API access only. Add a hostname to check Zone discovery and DNS read without mutating DNS:

```bash
cfm account doctor company-a \
  --hostname api-dev.example.com
```

A successful read-only doctor does not prove DNS write access.

## Adopt an existing token-only Tunnel

```bash
cfm account add company-a
cfm tunnel adopt company-a company-a \
  --tunnel-id <TUNNEL_UUID>
```

Adoption preserves the Token value and moves it from:

```text
legacy/tunnels/company-a.token
```

to:

```text
accounts/company-a/tunnels/company-a.token
```

It does not create another remote Tunnel.

## One-command expose workflow

```bash
cfm expose company-a \
  --name project-dev \
  --hostname api-dev.example.com \
  --port 3001
```

`cfm expose` reuses or creates a managed Tunnel, configures route/DNS, starts `cloudflared` unless disabled, and prints the public URL. It never silently adopts a token-only profile.

## Command overview

| Area | Commands |
| --- | --- |
| Lifecycle | `migrate`, `upgrade` |
| Local profiles | `init`, `add`, `remove`, `list` |
| Connector process | `start`, `stop`, `restart`, `start-all`, `stop-all`, `status`, `logs`, `doctor` |
| Accounts | `account add/list/show/doctor/remove` |
| Tunnels | `tunnel list/create/adopt/show/token/delete` |
| Routes | `route list/add/remove` |
| Orchestration | `expose` |

See [Command Reference](./COMMANDS.md).

## Security model

- Account API Tokens and Tunnel Tokens are separate credentials.
- API-managed credentials are grouped by Account.
- Token-only profiles remain under `legacy/tunnels/` until adoption.
- Credential files use mode `0600`.
- Raw credentials are not stored in `config.json` or printed normally.
- Migration never overwrites a different destination credential.
- Remote Tunnel deletion requires confirmation or `--yes`.
- `cfm upgrade` does not use shell interpolation and does not guess unknown/development installs.
- Prefer narrow Account/Zone scopes.

See [Security](./SECURITY.md).

## Documentation

- [Documentation index](./README.md)
- [繁體中文](./README.zh-TW.md)
- [日本語](./README.ja.md)
- [Upgrade guide](./UPGRADING.en.md)
- [Tunnel Token guide](./TUNNEL_TOKEN.en.md)
- [Architecture](./ARCHITECTURE.md)
- [Command Reference](./COMMANDS.md)
- [Configuration](./CONFIGURATION.md)
- [Security](./SECURITY.md)
- [Troubleshooting](./TROUBLESHOOTING.md)
- [Roadmap](./ROADMAP.md)
- [Changelog](../CHANGELOG.md)

## Development

```bash
git clone https://github.com/AdemKao/cloudflare-management.git
cd cloudflare-management
npm link
npm run check
```

## Scope

`cfm` is a focused Cloudflare Tunnel workflow tool, not a general-purpose Cloudflare administration CLI. Cloudflare remains the source of truth for Accounts, Zones, Tunnels, remote configuration, DNS, Access policies, and credential lifecycle.

## License

[MIT](../LICENSE) © 2026 Adem Kao
