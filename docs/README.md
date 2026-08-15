# Documentation

Welcome to the `cloudflare-management` documentation.

## Languages

- [English](./README.en.md)
- [繁體中文](./README.zh-TW.md)
- [日本語](./README.ja.md)

The repository root [README](../README.md) is the primary English project landing page. The localized READMEs follow the same structure so installation, upgrade, quick-start, security, and command information stay consistent across languages.

## Getting started

- [Upgrade — English](./UPGRADING.en.md)
- [Upgrade — 繁體中文](./UPGRADING.zh-TW.md)
- [Upgrade — 日本語](./UPGRADING.ja.md)
- [Tunnel Token — English](./TUNNEL_TOKEN.en.md)
- [Tunnel Token — 繁體中文](./TUNNEL_TOKEN.zh-TW.md)
- [Tunnel Token — 日本語](./TUNNEL_TOKEN.ja.md)
- [Command Reference](./COMMANDS.md) — token-only, Account, Tunnel, Route, and `expose` commands.

## Architecture and operations

- [Architecture](./ARCHITECTURE.md) — schema v2, Account → Tunnel → Route → Connector boundaries, migration, adoption, and process lifecycle.
- [v0.2 API Management](./V0.2_API_MANAGEMENT.md) — design decisions and implementation phases tracked by Issue #3.
- [Security](./SECURITY.md) — Account API Token vs Tunnel Token handling, least privilege, rotation, deletion, and offboarding.
- [Configuration](./CONFIGURATION.md) — config, secrets, state, logs, and XDG paths.
- [Troubleshooting](./TROUBLESHOOTING.md) — common tunnel, localhost, token, API, and hostname failures.
- [Roadmap](./ROADMAP.md) — completed phases and future work.
- [Contributing](../CONTRIBUTING.md) — development workflow and contribution guidelines.

## Install

Latest from `main`:

```bash
npm install -g github:AdemKao/cloudflare-management
```

Specific release:

```bash
npm install -g github:AdemKao/cloudflare-management#v0.2.0
```

## Update

```bash
npm install -g github:AdemKao/cloudflare-management
cfm --version
```

Updating the global CLI package does not remove local profiles or credentials because they are stored under the `cloudflare-management` config/state directories rather than inside the npm package installation.

Run diagnostics after an install/update:

```bash
cfm doctor
```

For API mode:

```bash
cfm account doctor <account>
```
