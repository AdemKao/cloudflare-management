# Roadmap

This roadmap describes the current direction for `cloudflare-management`.

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
- [x] multilingual documentation.

## v0.2 — Optional Cloudflare API provisioning

Tracking issue: #3

Implementation PR: #5

Domain model:

```text
Account
  └── Tunnel
       ├── Route / Published Application
       └── Connector
```

The original Tunnel Token workflow remains supported. Account API mode is optional.

### Phase 1 — Account API foundation and safe v1 migration

Implemented:

- [x] config schema v2;
- [x] automatic backward-compatible v1 migration;
- [x] metadata backup before the first migration write;
- [x] existing v1 profiles migrate as `token-only`;
- [x] existing profile names and Tunnel Token file paths are preserved;
- [x] existing `cfm add/start/stop/restart/status/logs/doctor` commands remain available;
- [x] atomic/idempotent config migration;
- [x] separate Account API Token storage;
- [x] `cfm account add/list/show/remove/doctor`;
- [x] Account alias and Tunnel/profile alias namespaces can coexist;
- [x] Cloudflare API adapter with timeout/error normalization;
- [x] Account ID / API Token validation during setup;
- [x] migration and credential unit tests.

### Phase 2 — Tunnel provisioning and adoption

Implemented:

- [x] `cfm tunnel list <account>`;
- [x] `cfm tunnel create <account> <name>`;
- [x] Tunnel ID and Tunnel Token persistence;
- [x] `cfm tunnel adopt <account> <existing-profile> [--tunnel-id <id>]`;
- [x] duplicate local-profile provisioning prevention;
- [x] adoption preserves the existing Tunnel Token by default;
- [x] `token-only`, `adopted`, and `provisioned` states;
- [x] `cfm tunnel show`;
- [x] safe Tunnel Token refresh without printing the raw token;
- [x] remote Tunnel delete with confirmation / `--yes`;
- [x] mocked Cloudflare API failure-path tests.

Current adoption behavior uses a unique remote-name match when possible and supports an explicit `--tunnel-id` when matching is ambiguous.

### Phase 3 — Route and DNS provisioning

Implemented:

- [x] remote Tunnel hostname → origin configuration;
- [x] `cfm route list/add/remove`;
- [x] optional DNS CNAME upsert/removal;
- [x] Tunnel creation/adoption without DNS privileges;
- [x] Account default Zone ID and per-command `--zone-id` override;
- [x] hostname, wildcard-hostname, origin, Account ID, Zone ID, and Tunnel ID validation;
- [x] DNS is changed only when explicitly requested by route commands.

### Phase 4 — Convenience workflow

Implemented:

```bash
cfm expose company-a \
  --name solana-dev \
  --hostname webhook-dev.example.com \
  --port 3001
```

Flow:

```text
Account validation
  → reuse adopted/provisioned Tunnel when present
  → create Tunnel only when the local profile does not exist
  → configure route
  → DNS by default (disable with --no-dns)
  → connector startup by default (disable with --no-start)
  → output public URL/status
```

Safety behavior:

- [x] token-only profiles are never silently adopted;
- [x] a local profile name collision never causes a duplicate Tunnel creation;
- [x] a newly-created Tunnel is rolled back when route/DNS provisioning fails;
- [x] connector startup failure does not silently destroy already-provisioned remote resources.

## v0.2 release validation

Code phases 1–4 are implemented in PR #5. Before tagging/releasing v0.2.0, complete a manual smoke test against a real scoped Cloudflare account:

- [ ] `cfm account add` using a least-privilege API Token;
- [ ] create a real test Tunnel;
- [ ] configure a test hostname route;
- [ ] verify optional DNS provisioning;
- [ ] start the connector and confirm public reachability;
- [ ] adopt a pre-existing Tunnel/profile;
- [ ] delete the temporary remote Tunnel;
- [ ] verify an existing v0.1 config upgrades without re-entering its Tunnel Token.

This live smoke test is intentionally separate from the automated suite because CI must not contain real client Cloudflare credentials.

## Security constraints

- Account API mode remains optional.
- Account API Tokens and Tunnel Tokens are separate credentials.
- Secret files use restrictive local permissions.
- Raw credentials are not stored in config metadata or normal CLI output.
- Use specific Account and Zone scopes; do not centralize unrestricted credentials across unrelated clients.
- Remote Tunnel deletion requires explicit confirmation.
- Existing token-only profiles do not become API-managed implicitly.

## Next candidates

- richer `doctor` connectivity checks;
- JSON/machine-readable output;
- zsh/bash/fish completion;
- macOS Keychain / 1Password optional secret backends;
- npm registry publishing and automated releases;
- Homebrew formula when useful;
- terminal GIF/asciinema demos;
- more Cloudflare API integration tests as upstream behavior evolves.

## Non-goals

The project does not aim to:

- replace `cloudflared`;
- implement the Cloudflare Tunnel protocol;
- become a general-purpose Cloudflare administration CLI;
- centralize multiple clients' unrestricted credentials;
- require API provisioning for the basic Tunnel Token workflow;
- auto-adopt or silently mutate unrelated remote Tunnels;
- create duplicate Tunnels merely because a user upgraded from v0.1;
- bypass Cloudflare account/security boundaries;
- prefer Global API Keys over scoped API Tokens.
