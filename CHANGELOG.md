# Changelog

All notable changes to `cloudflare-management` are documented here.

## v0.2.2 — 2026-08-15

### Fixed

- Cloudflare API responses with `success: false`, HTTP 200, and error code `10000` are now treated as authentication/authorization failures instead of surfacing only `Authentication error`;
- Zone auto-discovery reports the exact missing permission path and explains that Tunnel API access can succeed while Zone access fails;
- DNS record failures now identify the target hostname/Zone and explicitly point to `Zone -> DNS -> Edit` and Zone resource scope;
- `cfm account doctor <account>` now says it validates Tunnel API access only instead of implying all Cloudflare permissions are valid;
- `cfm account doctor <account> --hostname <hostname>` can additionally validate Zone discovery and DNS-read access without mutating DNS records;
- successful DNS route setup prints the discovered Zone when available.

### Why this patch exists

A valid Account API Token can pass Tunnel checks while still failing Zone/DNS APIs. Cloudflare may return code `10000` (`Authentication error`) in a response whose HTTP status is 200, so status-only authorization handling was insufficient.

Recommended diagnostic flow:

```bash
cfm account doctor company-a
cfm account doctor company-a --hostname api-dev.example.com
```

For automatic Zone discovery and DNS management, scope the token to the target Zone with the required Zone read and DNS edit permissions. An explicit `--zone-id <ZONE_ID>` can skip Zone discovery, but DNS write permission is still required.

### Upgrade

```bash
npm install -g github:AdemKao/cloudflare-management#v0.2.2
cfm --version
```

Or update to the latest `main`:

```bash
npm install -g github:AdemKao/cloudflare-management
cfm --version
```

## v0.2.1 — 2026-08-15

### Fixed

- `cfm route add ... --dns` no longer fails immediately when neither `--zone-id` nor an account default Zone ID is configured;
- `cfm` now attempts to discover the matching Cloudflare Zone from the hostname, starting with the full hostname and walking toward parent domains;
- automatic discovery filters returned Zones to the configured Cloudflare Account;
- DNS setup now returns actionable guidance when automatic discovery is denied because the API Token lacks `Zone:Zone:Read`;
- callers can still bypass discovery with an explicit `--zone-id` or an account `defaultZoneId`.

### Permissions

Automatic Zone discovery uses Cloudflare's `GET /zones` API and therefore requires `Zone:Zone:Read` for the target Zone. DNS record creation/update still requires the appropriate DNS write permission. Users who intentionally do not grant Zone Read can continue using:

```bash
cfm route add company-a project-dev \
  --hostname api-dev.example.com \
  --url http://localhost:3001 \
  --dns \
  --zone-id <ZONE_ID>
```

### Upgrade

Latest from `main` after release:

```bash
npm install -g github:AdemKao/cloudflare-management
cfm --version
```

Pinned release:

```bash
npm install -g github:AdemKao/cloudflare-management#v0.2.1
cfm --version
```

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
