# Changelog

All notable changes to `cloudflare-management` are documented here.

## v0.3.0 — 2026-08-15

### Added

- config schema v3;
- account-scoped credential directories under `accounts/<account>/`;
- `legacy/tunnels/` for token-only profiles that are not yet attached to a Cloudflare Account;
- `cfm migrate [--dry-run]` for explicit migration preview/execution;
- `cfm upgrade [--yes] [--dry-run] [--channel release|main] [--manager npm|brew]`;
- npm/GitHub stable updater that resolves and pins the latest GitHub Release tag;
- package-manager detection that refuses to guess unknown/development installations;
- installer abstraction with a Homebrew adapter ready for a future formula;
- migration and updater tests covering recovery, conflicts, installer detection, and shell-safe command execution.

### Changed

API-managed local credentials now follow the domain/security boundary:

```text
~/.config/cloudflare-management/
├── config.json
├── backups/
│   ├── config.v1.backup.json
│   └── config.v2.backup.json
├── accounts/
│   └── company-a/
│       ├── api-token
│       └── tunnels/
│           └── project-dev.token
└── legacy/
    └── tunnels/
        └── unbound-profile.token
```

A token-only profile remains unbound under `legacy/tunnels/`. Explicit adoption preserves the Token value while moving the credential into `accounts/<account>/tunnels/`.

### Migration safety

- v1 and v2 configs migrate directly to v3;
- Account/profile aliases and credential values are preserved;
- version-specific metadata backup is created before old metadata is replaced;
- config replacement is atomic;
- partial credential moves are recoverable on the next migration run;
- repeated successful migration is a no-op;
- a destination credential with different contents is never overwritten.

Preview before upgrading an important machine:

```bash
cfm migrate --dry-run
```

### Upgrade behavior

Users on v0.2.x must bootstrap once because those versions do not yet contain `cfm upgrade`:

```bash
npm install -g github:AdemKao/cloudflare-management#v0.3.0
cfm --version
cfm migrate --dry-run
cfm migrate
```

From v0.3 onward:

```bash
cfm upgrade
```

The updater uses argument arrays with `shell: false` and invokes `cfm migrate` after a successful package update.

Homebrew support in v0.3 is **adapter readiness only**. It does not claim that a formula/tap is already published.

### Backward compatibility

Existing profile aliases continue to work:

```bash
cfm start company-a
cfm status company-a
cfm logs company-a
```

The local credential path may move during migration, but the Token value and profile alias remain unchanged.

## v0.2.2 — 2026-08-15

### Fixed

- Cloudflare `success: false` + code `10000` responses are handled as authentication/authorization failures even when HTTP status is 200;
- Zone auto-discovery reports the missing Zone permission path;
- DNS failures identify the target Zone and DNS Edit/resource-scope requirement;
- basic `cfm account doctor` clearly validates Tunnel API access only;
- hostname-aware doctor validates Zone discovery and DNS-read access without mutating DNS;
- DNS route output reports the discovered Zone when available.

## v0.2.1 — 2026-08-15

### Fixed

- `cfm route add ... --dns` can discover the matching Zone from the hostname when no Zone ID/default is configured;
- Zone discovery is scoped to the configured Account;
- callers can bypass discovery with explicit `--zone-id`.

## v0.2.0 — 2026-08-15

### Added

- optional Cloudflare Account API mode;
- schema v2 and v1 metadata migration;
- Account / Tunnel / Route commands;
- `token-only`, `adopted`, and `provisioned` states;
- optional DNS automation and `cfm expose`;
- release automation and multilingual upgrade documentation.

## v0.1.0

Initial local Cloudflare Tunnel connector manager with Tunnel Token profiles, process management, logs, diagnostics, XDG-aware paths, CI, and multilingual documentation.
