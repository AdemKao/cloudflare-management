# Documentation

Welcome to the `cloudflare-management` documentation.

## Languages

- [English](./README.en.md)
- [繁體中文](./README.zh-TW.md)
- [日本語](./README.ja.md)

The repository root [README](../README.md) is the primary English project landing page.

## Getting started

- [Tunnel Token — English](./TUNNEL_TOKEN.en.md)
- [Tunnel Token — 繁體中文](./TUNNEL_TOKEN.zh-TW.md)
- [Tunnel Token — 日本語](./TUNNEL_TOKEN.ja.md)
- [Command Reference](./COMMANDS.md) — v0.2 token-only, Account, Tunnel, Route, and `expose` commands.

## Architecture and operations

- [Architecture](./ARCHITECTURE.md) — schema v2, Account → Tunnel → Route → Connector boundaries, migration, adoption, and process lifecycle.
- [v0.2 API Management](./V0.2_API_MANAGEMENT.md) — design decisions and implementation phases tracked by Issue #3.
- [Security](./SECURITY.md) — Account API Token vs Tunnel Token handling, least privilege, rotation, deletion, and offboarding.
- [Configuration](./CONFIGURATION.md) — config, secrets, state, logs, and XDG paths.
- [Troubleshooting](./TROUBLESHOOTING.md) — common tunnel, localhost, token, API, and hostname failures.
- [Roadmap](./ROADMAP.md) — completed v0.2 phases and remaining live release-validation checklist.
- [Contributing](../CONTRIBUTING.md) — development workflow and contribution guidelines.

## Install

From `main`:

```bash
npm install -g github:AdemKao/cloudflare-management
```

Test the v0.2 implementation branch before merge:

```bash
npm install -g github:AdemKao/cloudflare-management#feat/v0.2-api-management
```

Run diagnostics:

```bash
cfm doctor
```

For API mode:

```bash
cfm account doctor <account>
```
