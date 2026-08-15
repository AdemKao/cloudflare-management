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

The v0.1 security model intentionally requires an existing remotely-managed Tunnel and only stores the Tunnel-specific connector token locally.

## v0.2 — Optional Cloudflare API provisioning

Tracking issue: #3

v0.2 promotes the domain model from one local Tunnel profile to explicit Cloudflare resource boundaries:

```text
Account
  └── Tunnel
       ├── Route / Published Application
       └── Connector
```

The existing v0.1 Tunnel Token workflow remains supported. Account API mode is optional.

See [v0.2 API Management Design](./V0.2_API_MANAGEMENT.md) for the detailed proposal.

### Phase 1 — Account API foundation

- [ ] config schema v2 with backward-compatible v1 migration;
- [ ] separate secure Account API Token storage;
- [ ] `cfm account add/list/show/remove/doctor`;
- [ ] small Cloudflare API adapter with normalized timeouts/errors;
- [ ] validate Account ID and API Token during setup;
- [ ] unit tests for migration and credential handling.

### Phase 2 — Tunnel provisioning

- [ ] `cfm tunnel list <account>`;
- [ ] `cfm tunnel create <account> <name>`;
- [ ] persist returned Tunnel ID and Tunnel Token securely;
- [ ] `cfm tunnel show`;
- [ ] `cfm tunnel token`;
- [ ] safe `cfm tunnel delete` with explicit confirmation;
- [ ] Cloudflare API contract/failure-path tests.

### Phase 3 — Route and DNS provisioning

- [ ] remote Tunnel hostname → origin configuration;
- [ ] `cfm route list/add/remove`;
- [ ] optional DNS record provisioning when Zone DNS permission is available;
- [ ] allow Tunnel creation without DNS privileges;
- [ ] hostname and origin validation.

### Phase 4 — Convenience workflow

Evaluate a higher-level command such as:

```bash
cfm expose company-a \
  --name solana-dev \
  --hostname webhook-dev.example.com \
  --port 3001
```

Potential flow:

```text
Account validation
  → Tunnel creation
  → Tunnel Token storage
  → route configuration
  → optional DNS provisioning
  → connector startup
  → public URL/status output
```

## v0.2 security constraints

Account API mode must follow least privilege.

For Tunnel provisioning, the intended permission is scoped to the specific Cloudflare Account:

```text
Account → Cloudflare Tunnel → Edit
```

For optional DNS provisioning:

```text
Zone → DNS → Edit
```

The CLI should not require `All accounts`, `All zones`, or one shared unrestricted token across unrelated companies.

Tunnel Token-only users should never be forced to provide an Account-level API Token.

## Near-term developer experience candidates

### Better diagnostics

Potential additions to `cfm doctor`:

- verify the configured localhost origin is listening;
- optional public-hostname reachability check;
- detect stale or duplicate `cloudflared` connector processes;
- clearer exit codes for automation.

### Machine-readable output

```bash
cfm status --json
cfm doctor --json
```

### Shell completion

Potential support for:

- zsh;
- bash;
- fish.

### Safer profile editing

Possible commands:

```bash
cfm rename company-a company-a-new
cfm token rotate company-a
```

## Distribution candidates

Once the CLI stabilizes:

- npm registry release;
- automated semantic/versioned releases;
- GitHub Releases and changelog;
- potentially a Homebrew formula if there is enough demand.

## Documentation and developer experience

Potential improvements:

- terminal GIF/asciinema demonstration;
- more troubleshooting scenarios;
- release documentation;
- translated command/reference docs where useful;
- webhook development examples;
- Account API Token setup guide for v0.2.

## Non-goals

The project does not aim to:

- replace `cloudflared`;
- implement the Cloudflare Tunnel protocol;
- become a full Cloudflare account administration dashboard;
- centralize multiple clients' unrestricted credentials;
- require API provisioning for the basic Tunnel Token workflow;
- bypass Cloudflare account/security boundaries;
- prefer Global API Keys over scoped API Tokens.

These boundaries are intentional and should remain visible in future design discussions.
