# Command Reference

This page documents the `cfm` command surface in v0.2. The original v0.1 token-only workflow remains supported.

## Global options

```bash
cfm --help
cfm --version
```

## Token-only / backward-compatible commands

### `cfm init`

```bash
cfm init
```

Initializes configuration, secret, log, and runtime directories. Existing v1 configuration is migrated to schema v2 on first load with a metadata backup.

### `cfm add <name>`

Add a Tunnel Token for an existing remotely-managed Tunnel:

```bash
cfm add company-a
cfm add company-a --token-file ~/Downloads/company-a.token
```

Profiles created this way use `managementMode: token-only`. They do not require an Account API Token.

### Local connector lifecycle

```bash
cfm list
cfm start <name>
cfm stop <name>
cfm restart <name>
cfm start-all
cfm stop-all
cfm status [name]
cfm logs <name>
cfm logs <name> --follow
cfm doctor [name]
cfm remove <name>
cfm config
```

`cfm remove` only removes the local profile/token/log; it does not delete the remote Cloudflare Tunnel.

## Account API mode

API mode is optional. Use it when `cfm` should create/manage Cloudflare resources.

### `cfm account add <name>`

```bash
cfm account add company-a
```

Interactive prompts request the Cloudflare Account ID and API Token. Non-interactive token import:

```bash
cfm account add company-a \
  --account-id <ACCOUNT_ID> \
  --token-file ~/.secrets/company-a-api-token \
  --zone-id <OPTIONAL_DEFAULT_ZONE_ID>
```

The API credential is verified before account metadata is saved. Account aliases and local Tunnel/profile aliases are separate namespaces, so an existing `cfm add company-a` profile can coexist with `cfm account add company-a`.

### Account inspection

```bash
cfm account list
cfm account show company-a
cfm account doctor company-a
cfm account remove company-a --yes
```

Account removal is blocked while managed Tunnel profiles still reference the account.

## Tunnel provisioning

### List remote Tunnels

```bash
cfm tunnel list company-a
```

### Create a Tunnel

```bash
cfm tunnel create company-a project-dev
```

This creates a remotely-managed Tunnel through the Cloudflare API, retrieves its Tunnel Token, stores the token locally with restrictive permissions, and creates a `provisioned` local profile.

The command refuses to create a Tunnel when a local profile with the same name already exists. For a pre-existing manual Tunnel, use adoption instead.

### Adopt an existing v0.1/manual Tunnel

```bash
cfm tunnel adopt company-a company-a
```

If the remote Tunnel name cannot be resolved uniquely, provide its ID explicitly:

```bash
cfm tunnel adopt company-a company-a \
  --tunnel-id <TUNNEL_UUID>
```

Adoption changes the local profile from `token-only` to `adopted` and records the Account/Tunnel ID. It does **not** create another Tunnel and does **not** replace the existing Tunnel Token file.

### Show or refresh Tunnel credentials

```bash
cfm tunnel show company-a project-dev
cfm tunnel token company-a project-dev
```

`cfm tunnel token` refreshes the Tunnel Token into its protected local file. It intentionally does not print the raw token.

### Delete a remotely-managed Tunnel

```bash
cfm tunnel delete company-a project-dev
```

The command requires explicit confirmation. Automation may use:

```bash
cfm tunnel delete company-a project-dev --yes
```

This is different from `cfm remove`, which only removes local state.

## Published hostname routes

### List routes

```bash
cfm route list company-a project-dev
```

### Add/update hostname → origin

Without DNS mutation:

```bash
cfm route add company-a project-dev \
  --hostname api-dev.example.com \
  --url http://localhost:3001
```

Also create/update the DNS CNAME:

```bash
cfm route add company-a project-dev \
  --hostname api-dev.example.com \
  --url http://localhost:3001 \
  --dns
```

When `--dns` is enabled, `cfm` resolves the Zone ID in this order:

```text
1. --zone-id <ZONE_ID>
2. account defaultZoneId
3. automatic hostname-based Zone discovery
```

Automatic discovery checks the full hostname and then parent domains until a matching Cloudflare Zone is found, for example:

```text
api-dev.example.com
       ↓
example.com
```

Automatic discovery uses Cloudflare `GET /zones` and therefore requires `Zone:Zone:Read` for the target Zone. DNS record creation/update still requires the appropriate DNS write permission.

If you intentionally do not grant Zone Read, provide the Zone explicitly:

```bash
cfm route add company-a project-dev \
  --hostname api-dev.example.com \
  --url http://localhost:3001 \
  --dns \
  --zone-id <ZONE_ID>
```

### Remove a route

```bash
cfm route remove company-a project-dev \
  --hostname api-dev.example.com
```

Also remove matching DNS records. The same Zone resolution rules apply:

```bash
cfm route remove company-a project-dev \
  --hostname api-dev.example.com \
  --dns
```

Use `--zone-id <ZONE_ID>` to bypass automatic Zone discovery.

## `cfm expose` — Phase 4 convenience flow

Create or reuse a managed Tunnel, configure a route/DNS, and start the connector:

```bash
cfm expose company-a \
  --name project-dev \
  --hostname api-dev.example.com \
  --port 3001
```

Equivalent origin form:

```bash
cfm expose company-a \
  --name project-dev \
  --hostname api-dev.example.com \
  --url http://localhost:3001
```

Options:

```text
--zone-id <id>   Explicitly select a Zone and bypass auto-discovery
--no-dns         Configure Tunnel route only; do not touch DNS
--no-start       Provision/configure only; do not start cloudflared
```

Without `--zone-id`, `cfm expose` uses the account default Zone ID when configured and otherwise attempts hostname-based Zone discovery.

`cfm expose` reuses only `adopted` or `provisioned` profiles. A `token-only` profile must be explicitly adopted first; the convenience command will not silently attach or replace an existing Tunnel.

## Upgrade behavior from v0.1

A user who previously ran:

```bash
cfm add company-a
```

can upgrade to v0.2 and immediately continue:

```bash
cfm start company-a
cfm status company-a
cfm logs company-a
```

No Account API Token or re-registration is required. The existing token file path is preserved during migration.

If API management is desired later:

```bash
cfm account add company-a
cfm tunnel adopt company-a company-a
```

See [Architecture](./ARCHITECTURE.md), [Security](./SECURITY.md), and [Troubleshooting](./TROUBLESHOOTING.md).
