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

```bash
cfm add company-a
cfm start company-a
```

Use this when the remotely-managed Tunnel already exists. No Account API Token is required.

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

Account API Tokens and Tunnel Tokens are stored separately.

## Highlights

- multi-account isolation;
- backward compatibility for existing `cfm add <profile>` users;
- safe v1 → v2 config migration;
- explicit Tunnel adoption without duplication;
- Tunnel provisioning and remote configuration;
- optional DNS automation;
- automatic Cloudflare Zone discovery from the hostname when `--dns` is used without a Zone ID;
- permission-aware diagnostics for Tunnel vs Zone/DNS access;
- Cloudflare error code `10000` handling even when HTTP status is 200;
- one-command `cfm expose` workflow;
- mode-`0600` secret files;
- raw Tunnel Tokens kept out of process args;
- diagnostics, status, and logs;
- no runtime npm dependencies.

## Requirements

- macOS or Linux
- Node.js 20+
- `cloudflared` available in `PATH`
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

Specific release:

```bash
npm install -g github:AdemKao/cloudflare-management#v0.2.2
```

Verify:

```bash
cfm --version
cfm --help
```

## Update

Reinstall from `main` to update a GitHub-installed copy:

```bash
npm install -g github:AdemKao/cloudflare-management
cfm --version
```

Or pin a release:

```bash
npm install -g github:AdemKao/cloudflare-management#v0.2.2
cfm --version
```

Local profiles and credentials are stored outside the npm package directory, so reinstalling the CLI does not remove them. v0.1 → v0.2 migration automatically backs up v1 metadata, preserves Tunnel Token paths, and converts existing profiles to `token-only`.

Read [Upgrading](./UPGRADING.en.md) before updating important development machines.

## Quick start: existing Tunnel

```bash
cfm init
cfm add company-a
cfm start company-a
cfm status company-a
```

See [Tunnel Token setup](./TUNNEL_TOKEN.en.md).

## Quick start: create a Tunnel from the CLI

```bash
cfm account add company-a
cfm tunnel create company-a project-dev
cfm route add company-a project-dev \
  --hostname api-dev.example.com \
  --url http://localhost:3001
cfm start project-dev
```

Use `--dns` when the API Token also has DNS write permission for the target Zone:

```bash
cfm route add company-a project-dev \
  --hostname api-dev.example.com \
  --url http://localhost:3001 \
  --dns
```

With `--dns`, Zone selection follows this order:

```text
1. --zone-id <ZONE_ID>
2. account defaultZoneId
3. automatic discovery from the hostname
```

Automatic discovery walks from the full hostname toward parent domains, for example `api-dev.example.com` → `example.com`, and calls Cloudflare `GET /zones`. It therefore requires Zone read access for the target Zone. DNS record creation/update separately requires DNS edit access. If you do not want to grant Zone Read, pass `--zone-id <ZONE_ID>` explicitly.

Cloudflare may return `success: false` with error code `10000` (`Authentication error`) while the HTTP response is still 200. v0.2.2 recognizes this as an authentication/authorization failure and prints stage-specific Zone/DNS guidance.

### Permission diagnostics

`cfm account doctor company-a` validates Tunnel API access only:

```bash
cfm account doctor company-a
```

To also validate Zone discovery and DNS-read access for a hostname without changing DNS:

```bash
cfm account doctor company-a \
  --hostname api-dev.example.com
```

Or bypass Zone discovery with a known ID:

```bash
cfm account doctor company-a \
  --hostname api-dev.example.com \
  --zone-id <ZONE_ID>
```

A successful doctor does not mutate DNS and therefore does not prove DNS write permission. Route DNS automation still requires DNS edit access for the target Zone.

## One-command expose workflow

`cfm expose` uses the same Zone selection rules, so a default Zone ID is no longer mandatory when the token can discover the target Zone:

```bash
cfm expose company-a \
  --name project-dev \
  --hostname api-dev.example.com \
  --port 3001
```

By default, `cfm expose` configures DNS and starts the connector. Use `--no-dns` or `--no-start` to disable those steps. Token-only profiles are never silently adopted.

## Existing v0.1 users

If you previously ran:

```bash
cfm add company-a
```

upgrading does not require re-entering the Tunnel Token or adding an Account API Token:

```bash
cfm start company-a
cfm status company-a
cfm logs company-a
```

To opt into API management later:

```bash
cfm account add company-a
cfm tunnel adopt company-a company-a --tunnel-id <TUNNEL_UUID>
```

Adoption does not create another Tunnel or replace the existing Tunnel Token by default.

## Command overview

| Area | Commands |
| --- | --- |
| Local profiles | `init`, `add`, `remove`, `list` |
| Connector process | `start`, `stop`, `restart`, `start-all`, `stop-all`, `status`, `logs`, `doctor` |
| Accounts | `account add/list/show/doctor/remove` |
| Tunnels | `tunnel list/create/adopt/show/token/delete` |
| Routes | `route list/add/remove` |
| Orchestration | `expose` |

See [Command Reference](./COMMANDS.md).

## Security model

```text
~/.config/cloudflare-management/
├── config.json
└── secrets/
    ├── company-a.token
    ├── accounts/
    │   └── company-a.api-token
    └── tunnels/
        └── project-dev.token
```

- API Tokens and Tunnel Tokens are distinct credentials.
- Secret files use `0600` permissions.
- Raw credentials are not stored in `config.json`.
- Normal commands do not print raw tokens.
- Remote Tunnel deletion requires confirmation or `--yes`.
- Prefer specific Account/Zone scopes over broad cross-client credentials.
- Grant Zone Read only if you want automatic Zone discovery; otherwise provide an explicit/default Zone ID.
- Tunnel API checks succeeding does not imply DNS edit access exists.

See [Security](./SECURITY.md).

## Documentation

- [Documentation index](./README.md)
- [繁體中文](./README.zh-TW.md)
- [日本語](./README.ja.md)
- [Upgrade guide](./UPGRADING.en.md)
- [Tunnel Token guide](./TUNNEL_TOKEN.en.md)
- [Architecture](./ARCHITECTURE.md)
- [v0.2 API Design](./V0.2_API_MANAGEMENT.md)
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
