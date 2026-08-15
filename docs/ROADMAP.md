# Roadmap

This roadmap describes possible directions for `cloudflare-management`. It is intentionally not a promise that every item will ship.

The project should remain a small, auditable local management layer around the official `cloudflared` connector.

## v0.1 — Local tunnel manager

Current goals:

- [x] installable Node.js CLI;
- [x] `cfm` executable and long-form alias;
- [x] multiple independent client profiles;
- [x] hidden interactive tunnel-token input;
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

## Near-term candidates

### Better diagnostics

Potential additions to `cfm doctor`:

- verify the configured localhost origin is listening;
- optional public-hostname reachability check;
- detect stale or duplicate `cloudflared` connector processes;
- clearer exit codes for automation.

### Machine-readable output

Optional output such as:

```bash
cfm status --json
cfm doctor --json
```

This would make the CLI easier to integrate with scripts and developer tooling.

### Shell completion

Completion support for common shells:

- zsh;
- bash;
- fish.

### Safer profile editing

Possible commands:

```bash
cfm rename company-a company-a-new
cfm token rotate company-a
```

Any token-related workflow should preserve the project's least-privilege model.

## Distribution candidates

Once the CLI stabilizes:

- npm registry release;
- automated semantic/versioned releases;
- GitHub Releases and changelog;
- potentially a Homebrew formula if there is enough demand.

## Optional Cloudflare API integration

A future release may optionally support selected Cloudflare API operations, but only if they can be implemented with narrow scopes and explicit user consent.

Possible examples:

- list remotely-managed tunnels;
- inspect tunnel metadata;
- inspect published hostnames;
- assist with connector setup.

Account-wide API tokens should not become mandatory for normal local tunnel usage.

## Documentation and developer experience

Potential improvements:

- terminal GIF/asciinema demonstration;
- more troubleshooting scenarios;
- release documentation;
- translated command/reference docs where useful;
- examples for webhook development workflows.

## Non-goals

The project does not aim to:

- replace `cloudflared`;
- implement the Cloudflare Tunnel protocol;
- become a full Cloudflare account administration dashboard;
- centralize multiple clients' high-privilege credentials;
- bypass Cloudflare account/security boundaries.

These boundaries are intentional and should remain visible in future design discussions.
