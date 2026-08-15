# Documentation

Welcome to the `cloudflare-management` documentation.

## Languages

- [English](./README.en.md)
- [繁體中文](./README.zh-TW.md)
- [日本語](./README.ja.md)

The repository root [README](../README.md) is the primary English project landing page.

## Guides and reference

- [Architecture](./ARCHITECTURE.md) — component boundaries, multi-account model, and process lifecycle.
- [Security](./SECURITY.md) — token handling, least privilege, rotation, and client offboarding.
- [Configuration](./CONFIGURATION.md) — config, secret, state, log, and XDG paths.
- [Command Reference](./COMMANDS.md) — complete v0.1 CLI command reference.
- [Troubleshooting](./TROUBLESHOOTING.md) — common tunnel, localhost, token, and webhook failures.
- [Roadmap](./ROADMAP.md) — current scope, likely next steps, and explicit non-goals.
- [Contributing](../CONTRIBUTING.md) — development workflow and contribution guidelines.

## Quick links

Install the current feature branch:

```bash
npm install -g github:AdemKao/cloudflare-management#feat/local-cli
```

After merge to `main`:

```bash
npm install -g github:AdemKao/cloudflare-management
```

Run diagnostics:

```bash
cfm doctor
```
