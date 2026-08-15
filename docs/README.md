# Documentation

Welcome to the `cloudflare-management` documentation.

## Languages

- [English](./README.en.md)
- [繁體中文](./README.zh-TW.md)
- [日本語](./README.ja.md)

The repository root [README](../README.md) is the primary English landing page. All localized READMEs follow the same structure so install, upgrade, migration, security, and Quick Start information stays synchronized.

## Getting started

- [Upgrade — English](./UPGRADING.en.md)
- [Upgrade — 繁體中文](./UPGRADING.zh-TW.md)
- [Upgrade — 日本語](./UPGRADING.ja.md)
- [Tunnel Token — English](./TUNNEL_TOKEN.en.md)
- [Tunnel Token — 繁體中文](./TUNNEL_TOKEN.zh-TW.md)
- [Tunnel Token — 日本語](./TUNNEL_TOKEN.ja.md)
- [Command Reference](./COMMANDS.md) — `migrate`, `upgrade`, token-only profiles, Accounts, Tunnels, Routes, DNS, diagnostics, and `expose`.
- [Changelog](../CHANGELOG.md) — release-by-release changes and migration notes.

## v0.3 lifecycle

Preview or run the account-scoped storage migration:

```bash
cfm migrate --dry-run
cfm migrate
```

v0.2.x users bootstrap once:

```bash
npm install -g github:AdemKao/cloudflare-management#v0.3.0
```

Then v0.3+ can update with:

```bash
cfm upgrade
```

Homebrew support is adapter-ready for a future formula, but no Homebrew install method should be assumed until a formula/tap is actually published.

## Architecture and operations

- [Architecture](./ARCHITECTURE.md) — schema v3, Account → Tunnel → Route → Connector boundaries, account-scoped storage, migration, adoption, and updater architecture.
- [v0.2 API Management](./V0.2_API_MANAGEMENT.md) — historical design decisions for the Account/Tunnel API model.
- [Security](./SECURITY.md) — Account API Token vs Tunnel Token handling, storage boundaries, migration safety, updater safety, least privilege, rotation, deletion, and offboarding.
- [Configuration](./CONFIGURATION.md) — schema v3, account directories, legacy token-only storage, backups, state/log paths, and DNS Zone behavior.
- [Troubleshooting](./TROUBLESHOOTING.md) — migration conflicts/recovery, self-upgrade, Tunnel, API, Zone/DNS, Cloudflare code `10000`, and hostname failures.
- [Roadmap](./ROADMAP.md) — completed phases and future distribution work.
- [Contributing](../CONTRIBUTING.md) — development workflow and contribution guidelines.

## Install

Latest from `main`:

```bash
npm install -g github:AdemKao/cloudflare-management
```

v0.3.0:

```bash
npm install -g github:AdemKao/cloudflare-management#v0.3.0
```

## Diagnostics

```bash
cfm doctor
cfm account doctor <account>
cfm account doctor <account> --hostname <hostname>
cfm migrate --dry-run
cfm upgrade --dry-run
```
