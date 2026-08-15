# Roadmap

This roadmap describes the current direction for `cloudflare-management`. It is not a promise that every future item will ship exactly as written.

The project should remain a small, auditable management layer around Cloudflare's official APIs and the official `cloudflared` connector.

## v0.1 — Local Tunnel manager

Completed:

- [x] installable Node.js CLI;
- [x] multiple local Tunnel Token profiles;
- [x] protected local secret files;
- [x] `cloudflared` lifecycle management;
- [x] status/logs/diagnostics;
- [x] XDG-compatible paths;
- [x] CI/tests and multilingual documentation.

## v0.2 — Optional Cloudflare API provisioning

Tracking issue: #3

Completed:

- [x] schema v2 and v1 migration;
- [x] optional Account API credential mode;
- [x] Account / Tunnel / Route resource model;
- [x] `token-only`, `adopted`, `provisioned` states;
- [x] Tunnel create/list/show/delete/token refresh;
- [x] explicit adoption without duplicate Tunnel creation;
- [x] route and optional DNS management;
- [x] automatic Zone discovery;
- [x] permission-aware Account/Zone/DNS diagnostics;
- [x] `cfm expose` orchestration;
- [x] GitHub Release automation and multilingual upgrade documentation.

## v0.3 — Account-scoped storage and lifecycle commands

Tracking issue: #9

Completed implementation scope:

### Storage schema v3

- [x] each API-managed Cloudflare Account has its own local directory;
- [x] Account API Token stored at `accounts/<account>/api-token`;
- [x] adopted/provisioned Tunnel Tokens stored at `accounts/<account>/tunnels/<profile>.token`;
- [x] unbound token-only profiles stored at `legacy/tunnels/<profile>.token`;
- [x] runtime/log state remains separate from credential storage.

### v1/v2 → v3 migration

- [x] direct migration from v1 or v2 to schema v3;
- [x] `cfm migrate --dry-run` preview;
- [x] `cfm migrate` explicit execution;
- [x] automatic migration when an old config is loaded;
- [x] version-specific metadata backups under `backups/`;
- [x] Account/profile aliases preserved;
- [x] credential values preserved while paths move;
- [x] recoverable partial relocation;
- [x] idempotent repeated migration;
- [x] conflicting destination credential protection;
- [x] old v0.2 `config.v1.backup.json` preserved into the backup directory where possible.

### Adoption and storage boundary

- [x] token-only profiles remain unbound after migration;
- [x] explicit adoption moves the existing Token into the selected Account directory;
- [x] adoption keeps the Token value and remote Tunnel identity;
- [x] duplicate remote Tunnel/local attachment protections remain.

### Self-upgrade architecture

- [x] `cfm upgrade`;
- [x] `--dry-run`, `--yes`, stable release and `main` channels;
- [x] npm/global installation detection;
- [x] stable npm/GitHub updates pin the latest GitHub Release tag;
- [x] unknown/development installs are not automatically replaced;
- [x] updater commands use argument arrays with `shell: false`;
- [x] post-update `cfm migrate` invocation;
- [x] Homebrew adapter interface prepared for a future formula;
- [x] updater/migration tests.

### Documentation

- [x] root README updated for v0.3;
- [x] English / Traditional Chinese / Japanese README layouts synchronized;
- [x] multilingual v0.3 upgrade guides;
- [x] Configuration / Security / Commands / Troubleshooting / Architecture updated;
- [x] Homebrew adapter vs actual formula availability documented clearly.

## Security constraints

- Account API mode remains optional.
- Token-only users are never forced to add an Account API Token.
- Account API Tokens and Tunnel Tokens remain separate credential types.
- API-managed credentials must remain inside the owning Account boundary.
- Raw credentials must not be printed or stored inside `config.json`.
- Migration must never overwrite a different destination secret.
- Existing token-only profiles are never silently adopted.
- Destructive remote Tunnel operations require explicit confirmation.
- Self-upgrade must not use shell interpolation or guess unknown installation types.
- Prefer specific Account/Zone scopes over unrestricted cross-client credentials.

## Near-term candidates

- publish an official Homebrew formula/tap and validate the `brew upgrade` adapter end-to-end;
- optional npm registry publication in addition to GitHub installation;
- installation metadata/diagnostics that clearly show which package manager owns `cfm`;
- JSON output (`cfm status --json`, `cfm doctor --json`, migration plan JSON);
- zsh/bash/fish completion;
- optional macOS Keychain / 1Password credential backends;
- localhost/public-hostname health checks;
- clearer automation-oriented exit codes;
- live Cloudflare smoke-test automation/documentation.

## Non-goals

The project does not aim to:

- replace `cloudflared`;
- implement the Cloudflare Tunnel protocol;
- become a full Cloudflare administration dashboard;
- centralize unrelated clients under unrestricted credentials;
- require API provisioning for the basic Tunnel Token workflow;
- auto-adopt existing Tunnels;
- create duplicate Tunnels because a user upgraded;
- silently overwrite credential conflicts during migration;
- self-update an installation whose package manager cannot be identified safely;
- claim Homebrew distribution exists before a real formula/tap is published;
- prefer Global API Keys over scoped API Tokens.
