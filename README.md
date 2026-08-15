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

Use an existing remotely-managed Tunnel and store only its Tunnel Token locally:

```bash
cfm add company-a
cfm start company-a
```

No Account API Token is required. In v0.3, an unbound token-only profile is stored under `legacy/tunnels/` until you explicitly adopt it into an Account.

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

Account API Tokens and Tunnel Tokens are stored separately and grouped under the owning Account directory.

## Highlights

- **Multi-account isolation** — each Cloudflare Account gets its own local credential boundary.
- **Account-scoped storage** — `accounts/<account>/api-token` and `accounts/<account>/tunnels/*.token`.
- **Backward compatible** — existing v0.1/v0.2 profile aliases keep working after migration.
- **Safe schema v3 migration** — v1/v2 metadata is backed up; secret relocation is recoverable and conflict-safe.
- **Migration preview** — `cfm migrate --dry-run` shows every planned credential move.
- **Self-upgrade workflow** — `cfm upgrade` updates through the detected installer and then runs migration.
- **Future installer support** — updater abstraction supports the current npm/GitHub distribution and is ready for a future Homebrew formula.
- **Explicit adoption** — attach an existing manual Tunnel to API management without creating a duplicate; its Token moves into the selected Account boundary.
- **Tunnel provisioning** — list/create/show/delete remotely-managed Tunnels.
- **Published hostname management** — configure hostname → origin rules.
- **Optional DNS automation** — CNAME creation/removal only when requested and authorized.
- **Automatic Zone discovery** — resolve the matching Cloudflare Zone from a hostname when needed.
- **Permission-aware diagnostics** — distinguish Tunnel access from Zone/DNS access, including Cloudflare error code `10000`.
- **One-command expose flow** — provision/reuse Tunnel + route + DNS + connector startup.
- **Protected credentials** — mode-`0600` files outside the repository.
- **No raw Tunnel Token in process args** — `cloudflared tunnel run --token-file ...`.
- **No runtime npm dependencies** — Node.js 20+.

## Requirements

- macOS or Linux
- Node.js 20+
- `cloudflared` available in `PATH`
- Cloudflare access appropriate to the mode you use

macOS:

```bash
brew install cloudflared
```

## Install

Install the latest version from `main`:

```bash
npm install -g github:AdemKao/cloudflare-management
```

Install the v0.3.0 release:

```bash
npm install -g github:AdemKao/cloudflare-management#v0.3.0
```

Verify:

```bash
cfm --version
cfm --help
```

> Homebrew distribution is planned, but an updater adapter is not the same as a published Homebrew formula/tap. Until a formula is actually released, use the npm/GitHub installation above.

## Update

### Existing v0.2.x users: bootstrap once

`cfm upgrade` starts in v0.3, so update from v0.2.x once with:

```bash
npm install -g github:AdemKao/cloudflare-management#v0.3.0
cfm --version
cfm migrate --dry-run
cfm migrate
```

### v0.3 and later

After v0.3 is installed:

```bash
cfm upgrade
```

Preview only:

```bash
cfm upgrade --dry-run
```

Skip confirmation:

```bash
cfm upgrade --yes
```

Follow `main` intentionally instead of the stable release channel:

```bash
cfm upgrade --channel main
```

For the current npm/GitHub distribution, the stable channel resolves the latest GitHub Release tag and installs that exact tag. The updater uses argument arrays rather than shell interpolation and invokes `cfm migrate` after a successful update.

Read the multilingual [Upgrade guide](./docs/UPGRADING.en.md) before updating an important development machine.

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
│   │       ├── project-dev.token
│   │       └── webhook-dev.token
│   └── company-b/
│       ├── api-token
│       └── tunnels/
└── legacy/
    └── tunnels/
        └── unbound-profile.token
```

The filesystem now mirrors the domain model: API-managed Tunnel credentials live under the Account that owns them. A token-only profile remains unbound under `legacy/tunnels/` until explicit adoption.

## Safe migration from v0.1 / v0.2

Preview:

```bash
cfm migrate --dry-run
```

Apply:

```bash
cfm migrate
```

Migration preserves Account/profile aliases and credential contents while updating their file paths. Before replacing old metadata, `cfm` writes a version-specific backup under `backups/`.

The migration is designed to be recoverable if interrupted. If a destination credential already exists with **different** contents, migration stops instead of overwriting it.

Existing commands still use the same profile alias after migration:

```bash
cfm start company-a
cfm status company-a
cfm logs company-a
```

## Quick start: existing Tunnel

Get the Tunnel Token from Cloudflare, then:

```bash
cfm init
cfm add company-a
cfm start company-a
cfm status company-a
```

The token-only credential is stored under:

```text
legacy/tunnels/company-a.token
```

See the [Tunnel Token guide](./docs/TUNNEL_TOKEN.en.md).

## Quick start: create a Tunnel from the CLI

Register a narrowly scoped Account API credential:

```bash
cfm account add company-a
```

Then create a Tunnel:

```bash
cfm tunnel create company-a project-dev
```

Credentials are organized as:

```text
accounts/company-a/
├── api-token
└── tunnels/
    └── project-dev.token
```

Configure a published hostname:

```bash
cfm route add company-a project-dev \
  --hostname api-dev.example.com \
  --url http://localhost:3001
```

Add DNS management when authorized:

```bash
cfm route add company-a project-dev \
  --hostname api-dev.example.com \
  --url http://localhost:3001 \
  --dns
```

Zone selection order:

```text
1. --zone-id <ZONE_ID>
2. account defaultZoneId
3. automatic discovery from the hostname
```

Automatic discovery requires Zone read access. DNS record mutation separately requires DNS edit access for the target Zone.

### Check permissions before changing DNS

```bash
cfm account doctor company-a
```

The basic doctor checks Tunnel API access only. Add a hostname to validate Zone discovery and DNS read without mutating DNS:

```bash
cfm account doctor company-a \
  --hostname api-dev.example.com
```

A successful read-only doctor does not prove DNS write permission.

## Adopt an existing token-only Tunnel

Suppose this already exists:

```bash
cfm add company-a
```

Add the Account credential, then explicitly attach that profile to the existing remote Tunnel:

```bash
cfm account add company-a
cfm tunnel adopt company-a company-a \
  --tunnel-id <TUNNEL_UUID>
```

Adoption does not create another Tunnel or change the Token value. It moves the credential boundary from:

```text
legacy/tunnels/company-a.token
```

to:

```text
accounts/company-a/tunnels/company-a.token
```

## One-command expose workflow

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
resolve Zone ID
       ↓
manage DNS unless --no-dns
       ↓
start cloudflared unless --no-start
       ↓
print public URL/status
```

`cfm expose` never silently adopts a token-only profile.

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

Read the complete [Command Reference](./docs/COMMANDS.md).

## Security model

Key rules:

- Account API Tokens and Tunnel Tokens are distinct credentials.
- API-managed credentials are grouped by Account boundary.
- Unbound token-only profiles stay under `legacy/tunnels/`.
- Credential files use mode `0600`.
- Raw credentials are not stored in `config.json`.
- Normal commands do not print raw Tokens.
- Migration refuses to overwrite a different destination credential.
- Remote Tunnel deletion requires confirmation or `--yes`.
- `cfm upgrade` does not use shell interpolation and refuses to guess unknown/development installation types.
- Prefer specific Account and Zone scopes instead of broad cross-client credentials.

Read [Security](./docs/SECURITY.md) for the full model.

## Documentation

- [Documentation index](./docs/README.md)
- [English guide](./docs/README.en.md)
- [繁體中文](./docs/README.zh-TW.md)
- [日本語](./docs/README.ja.md)
- [Upgrade guide](./docs/UPGRADING.en.md)
- [Tunnel Token guide](./docs/TUNNEL_TOKEN.en.md)
- [Architecture](./docs/ARCHITECTURE.md)
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

The test suite covers config migration/recovery/conflicts, account-scoped storage, adoption relocation, Cloudflare API errors, DNS authorization, package-manager detection, and updater command construction using mocked dependencies.

## Scope

`cfm` is intentionally a focused Cloudflare Tunnel workflow tool, not a general-purpose Cloudflare administration CLI.

Cloudflare remains the source of truth for Accounts, Zones, Tunnels, remote configuration, DNS, Access policies, and credential issuance/revocation.

## License

[MIT](./LICENSE) © 2026 Adem Kao
