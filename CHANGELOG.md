# Changelog

All notable changes to `cloudflare-management` are documented here.

## v0.2.0 — 2026-08-15

### Added

- optional Cloudflare Account API mode;
- schema v2 with automatic v1 migration and metadata backup;
- `cfm account add/list/show/doctor/remove`;
- `cfm tunnel list/create/adopt/show/token/delete`;
- explicit `token-only`, `adopted`, and `provisioned` Tunnel states;
- `cfm route list/add/remove`;
- optional DNS CNAME management;
- `cfm expose` orchestration for Tunnel + route + DNS + connector startup;
- Cloudflare API error normalization and failure-path tests;
- multilingual upgrade documentation;
- aligned English, Traditional Chinese, and Japanese README layouts.

### Backward compatibility

Existing v0.1 profiles created with:

```bash
cfm add company-a
```

continue to work after upgrading. Existing profile aliases and Tunnel Token paths are preserved and migrated to `token-only` records. Account API mode remains optional.

### Security

- Account API Tokens and Tunnel Tokens are stored separately;
- secret files use restrictive permissions;
- raw credentials are not stored in `config.json`;
- normal commands do not print raw tokens;
- destructive remote Tunnel deletion requires confirmation or `--yes`;
- newly created remote resources are rolled back when provisioning fails where practical.

### Upgrade

Latest from `main`:

```bash
npm install -g github:AdemKao/cloudflare-management
cfm --version
```

Pinned release:

```bash
npm install -g github:AdemKao/cloudflare-management#v0.2.0
cfm --version
```

See `docs/UPGRADING.en.md`, `docs/UPGRADING.zh-TW.md`, or `docs/UPGRADING.ja.md`.

## v0.1.0

Initial local Cloudflare Tunnel connector manager with Tunnel Token profiles, process management, logs, diagnostics, XDG-aware paths, CI, and multilingual documentation.
