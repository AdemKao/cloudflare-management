# Architecture

[English README](./README.en.md) · [繁體中文 README](./README.zh-TW.md) · [日本語 README](./README.ja.md)

## Goal

`cloudflare-management` is intentionally a thin management layer around Cloudflare's remotely-managed Tunnel model and the official `cloudflared` connector.

The main design goal is safe isolation when one development machine works with multiple independent client/company Cloudflare accounts.

v0.1 is a local connector manager that needs only a Tunnel-specific token. v0.2 is planned to add an **optional** Cloudflare API mode for Account/Tunnel/route provisioning while preserving the v0.1 low-privilege workflow and existing local profiles.

## v0.1 high-level architecture

```text
Developer Mac
    │
    ├── cfm profile: company-a
    │      ├── local token file
    │      └── cloudflared process
    │                 │
    │                 ▼
    │          Cloudflare Account A
    │          company-a-dev Tunnel
    │                 │
    │          api-dev.company-a.com
    │                 │
    │                 ▼
    │          localhost:3001
    │
    ├── cfm profile: company-b
    │      ├── local token file
    │      └── cloudflared process
    │                 │
    │                 ▼
    │          Cloudflare Account B
    │          company-b-dev Tunnel
    │                 │
    │          hook-dev.company-b.com
    │                 │
    │                 ▼
    │          localhost:4001
    │
    └── cfm profile: company-c
           ├── local token file
           └── cloudflared process
                      │
                      ▼
               Cloudflare Account C
```

## Responsibility boundaries in v0.1

### Cloudflare Dashboard / API

Cloudflare remains the source of truth for:

- Tunnel creation;
- Tunnel ownership;
- Account/domain ownership;
- Published Application hostnames;
- DNS routing;
- origin/service routing;
- Tunnel Token rotation and revocation.

### `cfm`

The v0.1 CLI is responsible for local developer-machine concerns:

- profile metadata;
- local Tunnel Token file storage;
- starting a `cloudflared` connector;
- stopping/restarting a connector;
- PID/runtime state;
- connector logs;
- diagnostics.

### `cloudflared`

`cloudflared` remains responsible for the actual Cloudflare Tunnel connection. `cfm` launches it using a token file rather than implementing the Tunnel protocol itself.

## Local storage in v0.1

```text
~/.config/cloudflare-management/
├── config.json
└── secrets/
    ├── company-a.token
    ├── company-b.token
    └── company-c.token

~/.local/state/cloudflare-management/
├── logs/
│   ├── company-a.log
│   ├── company-b.log
│   └── company-c.log
└── runtime/
    ├── company-a.json
    ├── company-b.json
    └── company-c.json
```

`XDG_CONFIG_HOME` and `XDG_STATE_HOME` override the default locations when configured.

## v0.1 profile model

A profile represents one local connector/security boundary.

Example logical model:

```json
{
  "name": "company-a",
  "tokenFile": "~/.config/cloudflare-management/secrets/company-a.token"
}
```

In v0.1 the profile name is only a local alias. It does not necessarily reveal the Cloudflare Account ID or remote Tunnel ID.

## v0.1 process lifecycle

```text
cfm start company-a
        │
        ├── validate profile
        ├── validate token file
        ├── validate cloudflared exists
        ├── detect existing process
        │
        ▼
cloudflared tunnel run --token-file <company-a.token>
        │
        ├── PID/runtime metadata
        └── log output
```

`cfm stop`, `restart`, `status`, and `logs` operate on this locally tracked connector process.

## Why one security boundary per client

Different companies may have different:

- Cloudflare Accounts;
- domains;
- Access policies;
- team members;
- contractual/security requirements;
- offboarding timelines.

Keeping separate credentials and connector processes avoids coupling unrelated clients and makes revocation/offboarding safer.

## Planned v0.2 architecture

Tracking issue: #3

v0.2 introduces an optional Account API mode with a richer domain model:

```text
Account
  │
  └── Tunnel
       │
       ├── Route / Published Application
       │
       └── Connector
            └── local cloudflared process
```

The v0.1 Tunnel Token mode remains valid and should not require an Account-level API Token.

## Existing v0.1 profiles remain valid resources

A user may upgrade with an already-working profile:

```bash
cfm add company-a
cfm start company-a
```

v0.2 must not reinterpret this as "create a new Tunnel".

Instead, the existing profile migrates to a token-only Tunnel record:

```text
profile alias: company-a
managementMode: token-only
account: unknown/null
tunnelId: unknown/null
tokenFile: existing path
```

This allows the existing connector lifecycle to continue unchanged while leaving API management optional.

### Migration boundary

```text
v1 config
  │
  ├── back up metadata
  ├── preserve profile alias
  ├── preserve token path/value
  ├── preserve runtime/log compatibility
  │
  ▼
v2 config
  └── token-only Tunnel record
```

Migration must be atomic, idempotent, and recoverable.

Secret files should not be moved simply to make the v2 directory layout look cleaner.

## Token-only, adopted, and provisioned Tunnels

v0.2 should distinguish how a Tunnel record became manageable:

```text
token-only
  Existing/manual Tunnel known locally only by Tunnel Token.

adopted
  Existing/manual Tunnel explicitly attached to a Cloudflare Account + Tunnel ID.

provisioned
  Tunnel created by cfm through the Cloudflare API.
```

This distinction matters for safety, especially around destructive operations and duplicate creation.

## Adoption architecture

If a user later adds Account credentials:

```bash
cfm account add company-a
```

and already has a local profile also named `company-a`, those two names may coexist because they are separate resource namespaces:

```text
Account alias: company-a
Tunnel/profile alias: company-a
```

To attach the existing local profile to the real remote Tunnel, use an explicit adoption operation:

```bash
cfm tunnel adopt company-a company-a
```

Conceptual flow:

```text
Existing token-only profile
        │
        │  cfm tunnel adopt <account> <profile>
        ▼
verify Account API Token
        │
        ▼
list/resolve remote Tunnels
        │
        ▼
user explicitly selects Tunnel ID
        │
        ▼
attach account + tunnelId metadata
        │
        ▼
managementMode = adopted
```

Important rules:

- adoption does not create a new Tunnel;
- adoption does not replace the existing Tunnel Token by default;
- adoption does not restart/stop the local connector unless requested;
- matching by profile name alone is insufficient for automatic adoption;
- ambiguous remote matches must require user selection.

## v0.2 component boundaries

```text
cfm
├── CLI command layer
│
├── application/use-case layer
│   ├── accounts
│   ├── tunnels
│   │   ├── create
│   │   └── adopt
│   └── routes
│
├── Cloudflare API adapter
│   ├── account verification
│   ├── tunnel discovery/provisioning
│   ├── remote tunnel configuration
│   └── optional DNS operations
│
├── local config + secret storage
│   └── v1 → v2 migration
│
└── connector process manager
        │
        ▼
   cloudflared
        │
        ▼
Cloudflare Tunnel
```

Cloudflare API HTTP details should not be mixed directly into CLI command handlers. Commands should orchestrate application use cases; the Cloudflare adapter should own request/response handling and error normalization.

## v0.2 credential model

Two credential types must remain distinct.

### Account API Token

Used only when provisioning or managing Cloudflare resources through API mode.

Expected scope for Tunnel provisioning:

```text
Account → Cloudflare Tunnel → Edit
```

Optional DNS automation additionally requires:

```text
Zone → DNS → Edit
```

The token should be restricted to the specific client Account and required Zone(s).

### Tunnel Token

Used by `cloudflared` to run one remotely-managed Tunnel.

This remains the preferred credential for users who only need local connector execution.

## Proposed v0.2 storage model

New v0.2 credentials may use:

```text
~/.config/cloudflare-management/
├── config.json
└── secrets/
    ├── accounts/
    │   ├── company-a.api-token
    │   └── company-b.api-token
    └── tunnels/
        ├── solana-dev.token
        └── webhook-dev.token
```

Existing v0.1 token files may remain where they already are:

```text
~/.config/cloudflare-management/secrets/company-a.token
```

Logical schema:

```json
{
  "version": 2,
  "accounts": {
    "company-a": {
      "accountId": "ACCOUNT_ID",
      "apiTokenFile": "~/.config/cloudflare-management/secrets/accounts/company-a.api-token",
      "defaultZoneId": "ZONE_ID"
    }
  },
  "tunnels": {
    "company-a": {
      "managementMode": "adopted",
      "account": "company-a",
      "tunnelId": "EXISTING_TUNNEL_UUID",
      "tokenFile": "~/.config/cloudflare-management/secrets/company-a.token"
    },
    "solana-dev": {
      "managementMode": "provisioned",
      "account": "company-a",
      "tunnelId": "NEW_TUNNEL_UUID",
      "tokenFile": "~/.config/cloudflare-management/secrets/tunnels/solana-dev.token"
    }
  }
}
```

## Planned v0.2 workflows

### New Tunnel from zero

```text
cfm account add company-a
        │
        ├── capture Account ID
        ├── capture scoped API Token
        └── verify credential
        │
        ▼
cfm tunnel create company-a solana-dev
        │
        ├── call Cloudflare Tunnel API
        ├── persist Tunnel ID
        └── persist Tunnel Token securely
        │
        ▼
cfm route add company-a solana-dev
        │
        ├── configure hostname → origin
        └── optionally manage DNS
        │
        ▼
cfm start solana-dev
```

### Upgrade an existing v0.1 profile

```text
existing: cfm add company-a
        │
        ▼
automatic safe v1 → v2 migration
        │
        ├── remains token-only
        └── cfm start company-a still works
        │
        ▼
optional: cfm account add company-a
        │
        ▼
optional: cfm tunnel adopt company-a company-a
        │
        └── attach existing remote Tunnel ID
```

A future `cfm expose` command may compose provisioning steps but should be implemented only after create/adopt behavior is explicit and stable.

## Architecture rules for v0.2

- Account API mode is optional.
- Existing `cfm add/start/stop/status/logs` workflows remain backward compatible.
- Existing profiles migrate as token-only, not as new remotely-created Tunnels.
- `account` aliases and local Tunnel/profile aliases are separate namespaces.
- Existing remote Tunnels require explicit adoption before API management.
- Adoption never creates another Tunnel.
- API Tokens and Tunnel Tokens are stored separately.
- No secret may be printed in logs or command output.
- Do not use one unrestricted credential across unrelated clients.
- Destructive Cloudflare operations require explicit confirmation.
- Adopted resources should be clearly identified before destructive operations.
- `cfm` does not reimplement `cloudflared` or the Tunnel protocol.
- Cloudflare remains the source of truth for remote resources.
- DNS automation must remain optional so Tunnel creation/adoption does not require DNS permission.

See [v0.2 API Management Design](./V0.2_API_MANAGEMENT.md) for command design, migration, security, failure handling, and implementation phases.

## Other future extensions

Possible future versions may also add:

- project aliases and metadata;
- hostname/localhost health checks;
- shell completion;
- background service installation (`launchd`/`systemd`);
- encrypted secret backends such as macOS Keychain or 1Password;
- config import/export without secret material;
- JSON output for automation.

These should remain optional so the basic CLI can continue operating with minimum Cloudflare privileges.
