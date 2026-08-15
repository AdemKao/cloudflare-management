# Security

[English README](./README.en.md) · [繁體中文 README](./README.zh-TW.md) · [日本語 README](./README.ja.md)

## Security goals

`cloudflare-management` is designed around client/account isolation, least privilege, explicit adoption, and secret minimization.

Two credential modes remain independent:

- **Tunnel Token mode** — low privilege, used only to run an existing remotely-managed Tunnel.
- **Account API mode** — optional, used when `cfm` should create/manage Tunnels, routes, and optionally DNS.

## Account-scoped filesystem boundary in v0.3

API-managed credentials are grouped by Cloudflare Account alias:

```text
~/.config/cloudflare-management/
├── accounts/
│   ├── company-a/
│   │   ├── api-token
│   │   └── tunnels/
│   │       └── project-dev.token
│   └── company-b/
│       ├── api-token
│       └── tunnels/
└── legacy/
    └── tunnels/
        └── unbound-profile.token
```

This makes the local filesystem match the domain/security model:

```text
Account alias
├── Account API credential
└── Tunnel credentials owned by that Account
```

A token-only profile that has not been attached to an Account remains under `legacy/tunnels/`.

## Credential types

### Tunnel Token

A Tunnel Token is scoped to a remotely-managed Tunnel and is used by `cloudflared`.

Token-only/unbound profiles:

```text
~/.config/cloudflare-management/legacy/tunnels/<profile>.token
```

Adopted/provisioned profiles:

```text
~/.config/cloudflare-management/accounts/<account>/tunnels/<profile>.token
```

### Account API Token

An Account API Token is a higher-privilege credential used for Cloudflare API operations.

```text
~/.config/cloudflare-management/accounts/<account>/api-token
```

Raw credentials are never embedded in `config.json`.

## File permissions

Credential directories use restrictive permissions and credential files are written with mode `0600` where supported.

Metadata, Account IDs, Tunnel IDs, aliases, and credential-file paths may appear in `config.json`; raw credential values must not.

## Process command line

Connectors are launched with:

```bash
cloudflared tunnel run --token-file <path>
```

The raw Tunnel Token is not embedded in process arguments.

Account API Tokens are used only inside HTTPS API request headers and must never be printed to logs or normal command output.

## Least privilege

For Tunnel provisioning, use a Token restricted to the intended Cloudflare Account with only the Tunnel-management permissions required.

DNS permissions remain separate:

```text
Automatic Zone discovery  → Zone Read on the target Zone
DNS record mutation       → DNS Edit/Write on the target Zone
```

If `--zone-id <ZONE_ID>` or an account `defaultZoneId` is provided, automatic Zone listing is skipped. DNS edits still require DNS write permission.

Avoid broad credentials such as:

```text
All accounts
All zones
one unrestricted token shared across unrelated clients
Global API Keys as the preferred credential
```

## v1/v2 → v3 migration security

Migration changes credential paths, not credential values.

Before replacing metadata, `cfm` creates a version-specific backup under:

```text
~/.config/cloudflare-management/backups/
```

Migration rules:

- preserve aliases and secret contents;
- use atomic config replacement;
- make partial moves recoverable on the next run;
- never silently replace a Tunnel Token or API Token;
- refuse migration when a destination credential already exists with different contents;
- leave token-only profiles unbound until explicit adoption;
- never require Account API mode just to keep using an old token-only connector.

Preview every planned move with:

```bash
cfm migrate --dry-run
```

## Explicit adoption changes the storage boundary

A token-only profile becomes API-managed only through an explicit command:

```bash
cfm account add company-a
cfm tunnel adopt company-a company-a --tunnel-id <TUNNEL_UUID>
```

Adoption preserves the Token value while moving the credential from:

```text
legacy/tunnels/company-a.token
```

to:

```text
accounts/company-a/tunnels/company-a.token
```

`cfm` must not auto-adopt, create a duplicate remote Tunnel, or attach an ambiguous profile to an Account.

## Self-upgrade security

`cfm upgrade` is package-manager-aware.

Security rules:

- update commands are executed with argument arrays, not shell interpolation;
- unknown/development installs are not guessed or replaced automatically;
- stable npm/GitHub updates pin an actual GitHub Release tag;
- `--dry-run` shows the update/migration plan before any mutation;
- confirmation is required unless `--yes` is supplied;
- post-update migration is invoked as a separate `cfm migrate` process so the newly installed version can apply future schemas.

Homebrew support is adapter-ready for future formula distribution. Until a formula exists, users should not force `--manager brew` and assume it is an available distribution channel.

## Destructive operations

Remote Tunnel deletion requires confirmation or `--yes`:

```bash
cfm tunnel delete company-a project-dev --yes
```

Local `cfm remove <profile>` remains local-only and does not delete the remote Cloudflare Tunnel.

## Logs and errors

Never print or persist:

- Account API Token values;
- Tunnel Token values;
- Authorization headers;
- API request objects containing credentials.

Cloudflare API errors are normalized before display. Tests cover common 401/403/404/409/429/5xx cases, Cloudflare code `10000`, and credential-leakage checks.

Connector logs may contain hostnames, request metadata, network errors, or client-specific operational data. Review logs before sharing them publicly.

## Rotation

Tunnel Token rotation:

```bash
cfm tunnel token <account> <profile>
```

Account API Token rotation:

```bash
cfm account add <account> --force
```

The replacement Account API credential is validated before it replaces the previous local value.

## Offboarding

When work for a client ends:

1. stop local connectors;
2. remove/delete linked Tunnel profiles as appropriate;
3. revoke/rotate Tunnel Tokens in Cloudflare;
4. revoke the Account API Token;
5. remove your Cloudflare Account access when no longer required;
6. remove the local Account credential after linked profiles are gone;
7. review logs, temporary files, password-manager entries, and CI secrets.

The account-scoped directory makes the local boundary easy to audit, but do not recursively delete an Account directory while active profiles still depend on it.

## Future secret backends

Future optional backends may include macOS Keychain, 1Password CLI, or other OS-native credential stores. Any backend must preserve Account isolation and the token-only workflow.

## Reporting security issues

Do not include live Tunnel Tokens, Cloudflare API credentials, or client secrets in public GitHub issues. Revoke exposed credentials before sharing diagnostic information.
