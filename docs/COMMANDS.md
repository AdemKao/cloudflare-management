# Command Reference

This page documents the `cfm` command surface in v0.3. The original token-only workflow remains supported.

## Global options

```bash
cfm --help
cfm --version
```

## Lifecycle and maintenance

### `cfm migrate`

Preview local storage migration without changing files:

```bash
cfm migrate --dry-run
```

Run migration explicitly:

```bash
cfm migrate
```

v0.3 uses schema v3 and account-scoped credential storage. The same migration also runs automatically when a command first loads an older v1/v2 config.

Migration never changes the secret value. It changes where the credential is stored:

```text
v0.2
secrets/accounts/company-a.api-token
secrets/tunnels/project-dev.token
secrets/unbound-profile.token

v0.3
accounts/company-a/api-token
accounts/company-a/tunnels/project-dev.token
legacy/tunnels/unbound-profile.token
```

Before replacing old metadata, `cfm` creates a version-specific backup under `backups/`. Migration is recoverable after a partial move and refuses to overwrite a destination secret with different contents.

### `cfm upgrade`

From v0.3 onward, update the installed CLI through the detected package manager:

```bash
cfm upgrade
```

Useful options:

```text
--yes                 Skip confirmation
--dry-run             Show migration/update plan without changing anything
--channel release     Stable GitHub Release channel (default)
--channel main        Latest repository main branch; npm/GitHub installs only
--manager npm         Override installer detection
--manager brew        Override installer detection
```

Examples:

```bash
cfm upgrade --dry-run
cfm upgrade --yes
cfm upgrade --channel main --yes
```

For the current GitHub/npm distribution, the stable channel resolves the latest GitHub Release tag and executes the equivalent of:

```bash
npm install -g github:AdemKao/cloudflare-management#vX.Y.Z
```

The updater uses argument arrays and does not interpolate an update command through a shell. After a successful package update, it runs `cfm migrate` so future schema migrations can be applied by the newly installed CLI.

A Homebrew installer adapter is included for future formula distribution. Until an official formula/tap is published, `--manager brew` is only an adapter path and should not be treated as a currently available installation method.

### Bootstrap from v0.2.x

v0.2.x does not know the new `cfm upgrade` command. Update to v0.3.0 once using the existing installation method:

```bash
npm install -g github:AdemKao/cloudflare-management#v0.3.0
cfm --version
cfm migrate
```

After that, future releases can use:

```bash
cfm upgrade
```

## Token-only / backward-compatible commands

### `cfm init`

```bash
cfm init
```

Initializes configuration, credential, log, and runtime directories. Older config schemas migrate automatically.

### `cfm add <name>`

Add a Tunnel Token for an existing remotely-managed Tunnel:

```bash
cfm add company-a
cfm add company-a --token-file ~/Downloads/company-a.token
```

Profiles created this way use `managementMode: token-only`. They do not require an Account API Token and are stored under:

```text
~/.config/cloudflare-management/legacy/tunnels/<profile>.token
```

They move into an Account directory only after explicit adoption.

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

`cfm remove` only removes local profile state; it does not delete the remote Cloudflare Tunnel.

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

The credential is copied into:

```text
~/.config/cloudflare-management/accounts/company-a/api-token
```

Account aliases and local Tunnel/profile aliases remain separate namespaces, so `cfm add company-a` can coexist with `cfm account add company-a` until explicit adoption.

### Account inspection and permission diagnostics

```bash
cfm account list
cfm account show company-a
cfm account doctor company-a
cfm account remove company-a --yes
```

`cfm account doctor company-a` validates the Tunnel API credential only. To validate Zone discovery and DNS-read access without changing DNS:

```bash
cfm account doctor company-a \
  --hostname api-dev.example.com
```

Explicit Zone ID:

```bash
cfm account doctor company-a \
  --hostname api-dev.example.com \
  --zone-id <ZONE_ID>
```

A read-only diagnostic cannot prove DNS write permission. `cfm route ... --dns` is the operation that exercises DNS edit access.

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

This creates a remotely-managed Tunnel, retrieves its Tunnel Token, and stores it under the selected Account:

```text
~/.config/cloudflare-management/accounts/company-a/tunnels/project-dev.token
```

The command refuses to create a Tunnel when a local profile with the same name already exists.

### Adopt an existing/manual Tunnel

```bash
cfm tunnel adopt company-a company-a
```

If automatic matching is ambiguous:

```bash
cfm tunnel adopt company-a company-a \
  --tunnel-id <TUNNEL_UUID>
```

Adoption:

- does not create another remote Tunnel;
- records the Account/Tunnel relationship;
- preserves the existing Tunnel Token value;
- moves the Token file from `legacy/tunnels/` into `accounts/<account>/tunnels/`;
- refuses to overwrite a different destination credential.

### Show or refresh Tunnel credentials

```bash
cfm tunnel show company-a project-dev
cfm tunnel token company-a project-dev
```

`cfm tunnel token` refreshes the Token into its protected account-scoped file and never prints the raw value.

### Delete a remotely-managed Tunnel

```bash
cfm tunnel delete company-a project-dev
cfm tunnel delete company-a project-dev --yes
```

Remote deletion differs from `cfm remove`, which is local-only.

## Published hostname routes

### List routes

```bash
cfm route list company-a project-dev
```

### Add/update hostname → origin

Route only:

```bash
cfm route add company-a project-dev \
  --hostname api-dev.example.com \
  --url http://localhost:3001
```

Route plus DNS:

```bash
cfm route add company-a project-dev \
  --hostname api-dev.example.com \
  --url http://localhost:3001 \
  --dns
```

Zone resolution order:

```text
1. --zone-id <ZONE_ID>
2. account defaultZoneId
3. automatic hostname-based Zone discovery
```

Automatic discovery requires Zone read access; DNS record changes separately require DNS edit access for the target Zone.

### Remove a route

```bash
cfm route remove company-a project-dev \
  --hostname api-dev.example.com
```

Also remove matching DNS records:

```bash
cfm route remove company-a project-dev \
  --hostname api-dev.example.com \
  --dns
```

## `cfm expose`

Create or reuse a managed Tunnel, configure route/DNS, and start the connector:

```bash
cfm expose company-a \
  --name project-dev \
  --hostname api-dev.example.com \
  --port 3001
```

Equivalent URL form:

```bash
cfm expose company-a \
  --name project-dev \
  --hostname api-dev.example.com \
  --url http://localhost:3001
```

Options:

```text
--zone-id <id>   Explicit Zone ID
--no-dns         Do not mutate DNS
--no-start       Do not start cloudflared
```

`cfm expose` does not silently adopt a token-only profile.

## Existing v0.1/v0.2 users

Existing profile aliases continue to work after v0.3 migration:

```bash
cfm start company-a
cfm status company-a
cfm logs company-a
```

The **credential path may change**, but the profile alias and Token value do not.

Use:

```bash
cfm migrate --dry-run
```

before upgrading an important machine if you want to inspect every planned file relocation.

See [Configuration](./CONFIGURATION.md), [Security](./SECURITY.md), [Upgrading](./UPGRADING.en.md), and [Troubleshooting](./TROUBLESHOOTING.md).
