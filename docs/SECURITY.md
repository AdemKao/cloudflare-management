# Security

[English README](./README.en.md) · [繁體中文 README](./README.zh-TW.md) · [日本語 README](./README.ja.md)

## Security goals

`cloudflare-management` is designed around client/account isolation, least privilege, explicit adoption, and secret minimization.

v0.2 supports two independent credential modes:

- **Tunnel Token mode** — low privilege, used only to run an existing remotely-managed Tunnel.
- **Account API mode** — optional, used when `cfm` should create/manage Tunnels, routes, and optionally DNS.

Existing v0.1 users are never forced into Account API mode.

## Credential types

### Tunnel Token

A Tunnel Token is scoped to a specific remotely-managed Tunnel and is used by `cloudflared`.

Legacy/token-only files remain at their existing paths, for example:

```text
~/.config/cloudflare-management/secrets/company-a.token
```

New API-provisioned Tunnel tokens are stored under:

```text
~/.config/cloudflare-management/secrets/tunnels/<profile>.token
```

### Account API Token

An Account API Token is a higher-privilege credential used only for Cloudflare API operations.

It is stored separately:

```text
~/.config/cloudflare-management/secrets/accounts/<account>.api-token
```

The CLI never stores the raw API Token inside `config.json`.

## File permissions

Secret directories are created with restrictive permissions and secret files are written with mode `0600`.

Metadata, Tunnel IDs, Account IDs, aliases, and secret-file paths may appear in `config.json`; raw credential values must not.

## Process command line

Connectors are launched with:

```bash
cloudflared tunnel run --token-file <path>
```

The raw Tunnel Token is not embedded in the process arguments.

Account API Tokens are used only inside HTTPS API request headers and must never be printed to logs or command output.

## Least privilege

For Tunnel provisioning, use an API Token restricted to the specific client/company Cloudflare Account with the minimum Tunnel-management permission required by Cloudflare.

If DNS automation is needed, add DNS edit permission only for the required Zone(s).

Avoid:

```text
All accounts
All zones
one shared unrestricted token across unrelated clients
Global API Keys as the preferred credential
```

## Existing profile migration

A profile previously created with:

```bash
cfm add company-a
```

migrates to schema v2 as:

```text
managementMode: token-only
account: null
tunnelId: null
tokenFile: existing path
```

Migration rules:

- preserve the existing token path and value;
- create a metadata backup before first migration write;
- perform the config replacement atomically;
- keep migration idempotent;
- never silently replace a Tunnel Token;
- never require an Account API Token just to continue using the old connector.

## Explicit adoption

A token-only profile becomes API-managed only through an explicit command:

```bash
cfm account add company-a
cfm tunnel adopt company-a company-a
```

Adoption records the Account/Tunnel relationship but preserves the existing Tunnel Token by default.

`cfm` must not auto-adopt, silently create a duplicate remote Tunnel, or attach a profile to an ambiguous remote resource.

## Destructive operations

Remote Tunnel deletion requires explicit confirmation or `--yes`:

```bash
cfm tunnel delete company-a solana-dev --yes
```

Local `cfm remove <profile>` remains a local-only operation and does not delete the remote Cloudflare Tunnel.

## Logs and errors

Never print or persist:

- Account API Token values;
- Tunnel Token values;
- Authorization headers;
- API request objects containing secrets.

Cloudflare API errors are normalized before being displayed. Tests cover common 401/403/404/409/429/5xx failure paths and verify that token values are not included in errors.

Connector logs may still contain hostnames, request metadata, network errors, or client-specific operational data. Review logs before sharing them publicly.

## Rotation

Tunnel Token rotation:

```bash
cfm tunnel token <account> <profile>
```

This refreshes the token into the protected local file and intentionally does not print the raw value.

Account API Token rotation can be performed by re-running:

```bash
cfm account add <account> --force
```

The new credential is validated before the existing local Account API Token is replaced.

## Offboarding

When work for a client ends:

1. Stop local connectors.
2. Remove or detach local profiles as appropriate.
3. Revoke/rotate Tunnel Tokens in Cloudflare.
4. Revoke the Account API Token if API mode was configured.
5. Remove your Cloudflare account access when no longer required.
6. Review local logs, temporary token files, password-manager entries, and CI secrets.

## Future secret backends

The current protected-file model is intentionally simple. Future optional backends may include macOS Keychain, 1Password CLI, or other OS-native credential stores.

Any future backend must preserve account isolation and must not weaken the token-only workflow.

## Reporting security issues

Do not include live Tunnel Tokens, Cloudflare API credentials, or client secrets in public GitHub issues. Revoke exposed credentials before sharing diagnostic information.
