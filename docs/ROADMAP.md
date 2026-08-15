# Roadmap

This roadmap describes the current direction for `cloudflare-management`. It is not a promise that every item will ship exactly as written.

The project should remain a small, auditable management layer around Cloudflare's official APIs and the official `cloudflared` connector.

## v0.1 — Local Tunnel manager

Completed:

- [x] installable Node.js CLI;
- [x] `cfm` executable and long-form alias;
- [x] multiple independent client profiles;
- [x] hidden interactive Tunnel Token input;
- [x] token-file import;
- [x] local secret files with restrictive permissions;
- [x] `cloudflared` startup through `--token-file`;
- [x] start/stop/restart/status;
- [x] start-all/stop-all;
- [x] logs and log following;
- [x] local diagnostics;
- [x] XDG-compatible paths;
- [x] CI and tests;
- [x] multilingual documentation;
- [x] architecture/security documentation.

## v0.2 — Optional Cloudflare API provisioning

Tracking issue: #3

Completed implementation scope:

### Phase 1 — Account API foundation and safe v1 migration

- [x] config schema v2 with backward-compatible v1 migration;
- [x] metadata backup before the first migration write;
- [x] existing v1 profiles migrate as `token-only`;
- [x] existing profile names and Tunnel Token paths are preserved;
- [x] migration is atomic and idempotent;
- [x] secure Account API Token storage;
- [x] `cfm account add/list/show/remove/doctor`;
- [x] Account aliases and Tunnel/profile aliases use separate namespaces;
- [x] Cloudflare API adapter with normalized errors;
- [x] Account ID/API Token validation;
- [x] migration/backward-compatibility tests.

### Phase 2 — Tunnel provisioning and adoption

- [x] `cfm tunnel list <account>`;
- [x] `cfm tunnel create <account> <name>`;
- [x] persist Tunnel ID and Tunnel Token securely;
- [x] `cfm tunnel adopt <account> <existing-profile> [--tunnel-id <id>]`;
- [x] adoption does not create duplicate Tunnels;
- [x] adoption preserves existing Tunnel Token by default;
- [x] distinguish `token-only`, `adopted`, and `provisioned` records;
- [x] `cfm tunnel show`;
- [x] `cfm tunnel token`;
- [x] safe `cfm tunnel delete` confirmation;
- [x] API failure-path tests.

### Phase 3 — Route and DNS provisioning

- [x] remote Tunnel hostname → origin configuration;
- [x] `cfm route list/add/remove`;
- [x] optional DNS record provisioning/removal;
- [x] Tunnel/route management without DNS privilege when DNS mutation is not requested;
- [x] hostname/origin validation.

### Phase 4 — Convenience workflow

- [x] `cfm expose`;
- [x] reuse adopted/provisioned Tunnel;
- [x] create only when no local profile exists;
- [x] never silently adopt a token-only profile;
- [x] optional DNS with `--no-dns`;
- [x] optional connector startup with `--no-start`;
- [x] public URL/status output;
- [x] rollback newly-created Tunnel when later provisioning fails where practical.

### v0.2 documentation and release UX

- [x] root README updated for v0.2;
- [x] English / Traditional Chinese / Japanese READMEs aligned to the same information architecture;
- [x] generic documentation examples (`company-a`, `project-dev`, `api-dev.example.com`);
- [x] multilingual Tunnel Token guides updated for both operating modes;
- [x] multilingual upgrade guides;
- [x] install/update/pinned-release instructions;
- [x] `CHANGELOG.md` for v0.2.0.

## Security constraints

- Account API mode is optional.
- Existing Tunnel Token-only users are never forced to provide an Account API Token.
- Account API Tokens and Tunnel Tokens are separate credential types.
- Use specific Account/Zone scopes instead of unrestricted cross-client tokens.
- Raw credentials must not be printed or stored in `config.json`.
- Existing token-only profiles are never silently adopted.
- Destructive remote Tunnel operations require explicit confirmation.

## Near-term candidates

- live Cloudflare smoke-test checklist automation/documentation;
- JSON output (`cfm status --json`, `cfm doctor --json`);
- zsh/bash/fish completion;
- optional macOS Keychain / 1Password secret backends;
- automated semantic/versioned GitHub releases;
- npm registry publication;
- Homebrew formula if there is enough demand;
- localhost/public-hostname health checks;
- clearer automation-oriented exit codes.

## Non-goals

The project does not aim to:

- replace `cloudflared`;
- implement the Cloudflare Tunnel protocol;
- become a full Cloudflare account administration dashboard;
- centralize multiple clients' unrestricted credentials;
- require API provisioning for the basic Tunnel Token workflow;
- auto-adopt or silently mutate existing remote Tunnels;
- create duplicate Tunnels simply because a user upgraded from v0.1;
- bypass Cloudflare account/security boundaries;
- prefer Global API Keys over scoped API Tokens.
