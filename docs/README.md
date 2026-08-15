# Documentation

Welcome to the `cloudflare-management` documentation.

## Languages

- [English](./README.en.md)
- [繁體中文](./README.zh-TW.md)
- [日本語](./README.ja.md)

The repository root [README](../README.md) is the primary English project landing page.

## Getting started

### Cloudflare Tunnel Token

`cfm` v0.1 uses a **Tunnel Token**, not a general Cloudflare API Token. Use the guide below to find the token in the current Cloudflare Dashboard and add it safely to `cfm`.

- [English — Get a Cloudflare Tunnel Token](./TUNNEL_TOKEN.en.md)
- [繁體中文 — 取得 Cloudflare Tunnel Token](./TUNNEL_TOKEN.zh-TW.md)
- [日本語 — Cloudflare Tunnel Token の取得方法](./TUNNEL_TOKEN.ja.md)

Current Cloudflare Dashboard path:

```text
Cloudflare Dashboard
→ Switch to the correct Account
→ Networking
→ Tunnels
→ Select your Tunnel
→ Overview
→ Add a replica
```

## Guides and reference

- [Architecture](./ARCHITECTURE.md) — component boundaries, multi-account model, and process lifecycle.
- [Security](./SECURITY.md) — token handling, least privilege, rotation, and client offboarding.
- [Configuration](./CONFIGURATION.md) — config, secret, state, log, and XDG paths.
- [Command Reference](./COMMANDS.md) — complete v0.1 CLI command reference.
- [Troubleshooting](./TROUBLESHOOTING.md) — common tunnel, localhost, token, and webhook failures.
- [Roadmap](./ROADMAP.md) — current scope, likely next steps, and explicit non-goals.
- [Contributing](../CONTRIBUTING.md) — development workflow and contribution guidelines.

## Quick links

Install from `main`:

```bash
npm install -g github:AdemKao/cloudflare-management
```

Verify the CLI:

```bash
cfm --version
cfm --help
```

Run diagnostics:

```bash
cfm doctor
```
