# Configuration

`cloudflare-management` stores metadata, credentials, runtime state, and logs outside the repository.

## Default paths in v0.3

```text
~/.config/cloudflare-management/
├── config.json
├── backups/
│   ├── config.v1.backup.json
│   └── config.v2.backup.json
├── accounts/
│   ├── company-a/
│   │   ├── api-token
│   │   └── tunnels/
│   │       ├── project-dev.token
│   │       └── webhook-dev.token
│   └── company-b/
│       ├── api-token
│       └── tunnels/
└── legacy/
    └── tunnels/
        └── unbound-profile.token

~/.local/state/cloudflare-management/
├── logs/
│   └── <profile>.log
└── runtime/
    └── <profile>.json
```

The filesystem now mirrors the security/domain boundary: an API-managed Tunnel belongs to one Cloudflare Account directory. A token-only profile that is not yet attached to an Account remains under `legacy/tunnels/`.

## XDG support

When `XDG_CONFIG_HOME` is set:

```text
$XDG_CONFIG_HOME/cloudflare-management/
```

When `XDG_STATE_HOME` is set:

```text
$XDG_STATE_HOME/cloudflare-management/
```

## Schema v3

A simplified v0.3 configuration:

```json
{
  "version": 3,
  "accounts": {
    "company-a": {
      "accountId": "ACCOUNT_ID",
      "apiTokenFile": "/Users/you/.config/cloudflare-management/accounts/company-a/api-token",
      "defaultZoneId": null
    }
  },
  "tunnels": {
    "project-dev": {
      "managementMode": "provisioned",
      "account": "company-a",
      "tunnelId": "TUNNEL_UUID",
      "remoteName": "project-dev",
      "tokenFile": "/Users/you/.config/cloudflare-management/accounts/company-a/tunnels/project-dev.token"
    },
    "unbound-profile": {
      "managementMode": "token-only",
      "account": null,
      "tunnelId": null,
      "remoteName": null,
      "tokenFile": "/Users/you/.config/cloudflare-management/legacy/tunnels/unbound-profile.token"
    }
  }
}
```

Raw API Tokens and Tunnel Tokens are never embedded in `config.json`.

## Management modes

```text
token-only
  Existing/manual Tunnel; only a local Tunnel Token is required.
  It is not yet bound to a Cloudflare Account alias.

adopted
  Existing/manual Tunnel explicitly attached to an Account alias + remote Tunnel ID.

provisioned
  Tunnel created by cfm through the Cloudflare API.
```

## Automatic migration to v3

`cfm` automatically migrates v1 and v2 metadata when a command first loads the config. You can preview or run the same migration explicitly:

```bash
cfm migrate --dry-run
cfm migrate
```

Migration rules:

1. keep account/profile aliases unchanged;
2. preserve credential contents;
3. create a metadata backup before replacing the old config;
4. move Account API Tokens to `accounts/<account>/api-token`;
5. move adopted/provisioned Tunnel Tokens to `accounts/<account>/tunnels/<profile>.token`;
6. move unbound `token-only` Tunnel Tokens to `legacy/tunnels/<profile>.token`;
7. write schema v3 atomically;
8. refuse to overwrite a destination secret when its contents differ.

The migration is designed to recover after interruption. If a credential was already moved but the old v1/v2 metadata is still present, the next migration run recognizes the destination file and continues rather than creating a second secret.

### Backups

For a v1 source config:

```text
~/.config/cloudflare-management/backups/config.v1.backup.json
```

For a v2 source config:

```text
~/.config/cloudflare-management/backups/config.v2.backup.json
```

Older v0.2 installations may already have `~/.config/cloudflare-management/config.v1.backup.json`; v0.3 preserves/copies that legacy backup into the `backups/` directory when possible.

## Adoption moves the credential boundary

A profile created with:

```bash
cfm add company-a
```

starts under:

```text
legacy/tunnels/company-a.token
```

After explicit adoption:

```bash
cfm account add company-a
cfm tunnel adopt company-a company-a --tunnel-id <TUNNEL_UUID>
```

its existing Token value is preserved while the file is moved to:

```text
accounts/company-a/tunnels/company-a.token
```

Adoption does not create another remote Tunnel and does not silently replace the Tunnel Token.

## Account aliases vs Tunnel/profile aliases

These are separate namespaces. This remains valid:

```bash
cfm add company-a
cfm account add company-a
```

The first creates/uses a Tunnel profile alias; the second creates/uses an Account alias. Only explicit adoption binds them together.

## Default Zone ID and automatic discovery

An Account may store an optional `defaultZoneId`. Tunnel provisioning itself does not require a Zone ID or DNS permission.

When DNS automation is requested, Zone selection is:

```text
1. per-command --zone-id <ZONE_ID>
2. account defaultZoneId
3. automatic hostname-based Zone discovery
```

Example:

```bash
cfm route add company-a project-dev \
  --hostname api-dev.example.com \
  --url http://localhost:3001 \
  --dns
```

Automatic discovery uses Cloudflare Zone read access. DNS record changes still require the appropriate DNS write permission.

## Runtime state and logs

Runtime state remains separate from credential storage:

```text
~/.local/state/cloudflare-management/
├── logs/
└── runtime/
```

This means moving a credential into an Account directory does not change the profile name used by:

```bash
cfm start project-dev
cfm status project-dev
cfm logs project-dev
```

## File permissions

Credential directories use restrictive permissions and secret files are written with mode `0600` where supported.

See [Security](./SECURITY.md) and [Upgrading](./UPGRADING.en.md).
