# Troubleshooting

This guide covers local connector problems, Account/Tunnel/Route API-mode failures, v0.3 storage migration, and self-upgrade behavior.

## Start here

```bash
cfm --version
cfm doctor
cfm status company-a
```

For Account API mode:

```bash
cfm account doctor company-a
```

To also validate Zone discovery and DNS-read access:

```bash
cfm account doctor company-a \
  --hostname api-dev.example.com
```

## `cloudflared` is not found

```bash
cloudflared --version
```

macOS:

```bash
brew install cloudflared
```

If installed but unresolved, inspect your shell `PATH`.

## Tunnel exits immediately after `cfm start`

```bash
cfm logs company-a
```

Typical causes:

- invalid/incomplete Tunnel Token;
- Token rotated or revoked;
- remote Tunnel deleted;
- connector configuration rejected.

For a token-only profile:

```bash
cfm add company-a --token-file ~/Downloads/company-a-new.token --force
```

For an adopted/provisioned profile:

```bash
cfm tunnel token company-a project-dev
cfm restart project-dev
```

## `cfm migrate --dry-run` reports credential moves

This is expected in v0.3. The new layout groups managed credentials by Cloudflare Account:

```text
accounts/<account>/api-token
accounts/<account>/tunnels/<profile>.token
legacy/tunnels/<unbound-profile>.token
```

Previewing migration changes nothing:

```bash
cfm migrate --dry-run
```

Apply it explicitly:

```bash
cfm migrate
```

The same migration runs automatically when an older v1/v2 config is first loaded.

## Migration says destination exists with different contents

`cfm` intentionally refuses to guess which secret is correct.

Example failure means both old and new paths contain different values. Do **not** delete either credential until you know which one belongs to the intended Cloudflare Account/Tunnel.

Recommended steps:

```bash
cfm migrate --dry-run
cfm config
```

Then inspect only file paths/metadata. Do not paste Token contents into an Issue or chat.

Once the conflict is resolved manually, run:

```bash
cfm migrate
```

## Migration was interrupted halfway

v0.3 migration is recoverable. The old config metadata remains v1/v2 until the final atomic config replacement. If a secret was already moved, the next run recognizes a missing source + existing destination and continues.

Run:

```bash
cfm migrate --dry-run
cfm migrate
```

Do not move credentials back just because the previous process stopped unexpectedly.

## Where are migration backups?

```text
~/.config/cloudflare-management/backups/config.v1.backup.json
~/.config/cloudflare-management/backups/config.v2.backup.json
```

Older v0.2 installations may also still have:

```text
~/.config/cloudflare-management/config.v1.backup.json
```

v0.3 preserves/copies that legacy backup when possible.

## Existing `cfm add` profile moved after upgrade

This is expected. A token-only profile keeps the same profile alias and Token value, but v0.3 stores it under:

```text
legacy/tunnels/<profile>.token
```

Commands remain unchanged:

```bash
cfm start company-a
cfm status company-a
cfm logs company-a
```

When you explicitly adopt that Tunnel into an Account, the Token file moves again into:

```text
accounts/<account>/tunnels/<profile>.token
```

## `cfm upgrade` is unknown

Versions before v0.3 do not contain the self-upgrade command. Bootstrap once with the existing npm/GitHub installation method:

```bash
npm install -g github:AdemKao/cloudflare-management#v0.3.0
cfm --version
cfm migrate
```

After that:

```bash
cfm upgrade
```

## `cfm upgrade` cannot identify the install manager

This intentionally happens for development/manual installations where automatic replacement could modify the wrong copy.

Preview first:

```bash
cfm upgrade --dry-run
```

If you know the installation is npm-managed:

```bash
cfm upgrade --manager npm
```

If it is a source checkout using `npm link`, update the repository manually instead of forcing the global-package updater.

## `cfm upgrade --manager brew` fails

The v0.3 code includes a Homebrew installer adapter for future formula distribution, but an adapter does not mean an official formula/tap is already published.

Until a Homebrew formula exists, use the current npm/GitHub distribution. Do not force `--manager brew` on an npm installation.

## `cfm upgrade` cannot resolve the latest release

Stable npm/GitHub upgrades query the repository's latest GitHub Release tag. Network/API failures prevent `cfm` from safely choosing a release.

You can either retry later or intentionally use the development channel:

```bash
cfm upgrade --channel main
```

`main` is not the same as a tagged stable release.

## `cfm upgrade` updates the package but migration fails

The package update may have succeeded even if the post-update migration command failed. Run:

```bash
cfm --version
cfm migrate --dry-run
cfm migrate
```

The updater never passes secrets on the command line.

## Account doctor says Tunnel API is OK but DNS still fails

Tunnel and Zone/DNS permissions are independent:

```text
Tunnel operations         → Account-level Tunnel permission
Automatic Zone discovery  → Zone Read
DNS record mutation       → DNS Edit/Write
```

Use:

```bash
cfm account doctor company-a \
  --hostname api-dev.example.com
```

A successful doctor result validates DNS read, not DNS write.

## `Authentication error` / Cloudflare code `10000`

Cloudflare can return `success: false` with code `10000` even with HTTP 200. `cfm` recognizes this as authentication/authorization failure.

For Zone discovery, verify Zone Read on the target Zone or pass:

```bash
--zone-id <ZONE_ID>
```

For DNS mutation, verify DNS Edit/Write and that Zone Resources includes the intended Zone. Passing `--zone-id` does not bypass DNS write permission.

## Account API returns 401

The configured API credential is invalid/expired/revoked.

```bash
cfm account add company-a --force
cfm account doctor company-a
```

## Account API returns 403

The credential is recognized but lacks permission for the requested action. Do not fix a 403 by granting all Accounts/Zones by default.

If DNS automation is not needed:

```bash
cfm route add company-a project-dev \
  --hostname api-dev.example.com \
  --url http://localhost:3001
```

## API returns 404

Confirm Account ID, Tunnel ID, and Zone ID belong to the intended security boundary:

```bash
cfm account show company-a
cfm tunnel list company-a
cfm tunnel show company-a project-dev
```

## API returns 409 / resource conflict

Inspect local and remote resources first:

```bash
cfm list
cfm tunnel list company-a
```

If the Tunnel already exists, adopt it rather than creating a duplicate:

```bash
cfm tunnel adopt company-a company-a --tunnel-id <TUNNEL_UUID>
```

## API returns 429

Cloudflare is rate limiting requests. Stop tight retry loops and retry later.

## Cloudflare 5xx or timeout

Inspect remote state before retrying destructive operations:

```bash
cfm tunnel list company-a
```

## `cfm tunnel adopt` cannot uniquely resolve a Tunnel

Specify the remote Tunnel ID:

```bash
cfm tunnel list company-a
cfm tunnel adopt company-a company-a --tunnel-id <TUNNEL_UUID>
```

Adoption preserves the existing Token value and moves the file into the Account directory.

## `cfm route ... --dns` says Zone discovery was denied

Zone resolution order:

```text
1. --zone-id <ZONE_ID>
2. account defaultZoneId
3. automatic hostname-based Zone discovery
```

Options:

1. grant narrowly-scoped Zone Read;
2. pass `--zone-id <ZONE_ID>`;
3. omit `--dns` and manage DNS separately.

## `cfm expose` refuses a token-only profile

This is intentional. Explicitly adopt first:

```bash
cfm account add company-a
cfm tunnel adopt company-a company-a --tunnel-id <TUNNEL_UUID>
```

## Tunnel is running but public hostname fails

Check each layer:

```bash
curl -i http://localhost:3001
cfm status project-dev
cfm logs project-dev
cfm route list company-a project-dev
curl -i https://api-dev.example.com
```

A `502` usually means the local origin is unavailable. A `404` can mean a missing hostname route or application path.

## Token permission warning

Credential files should remain private. v0.3 paths include:

```text
~/.config/cloudflare-management/accounts/<account>/api-token
~/.config/cloudflare-management/accounts/<account>/tunnels/<profile>.token
~/.config/cloudflare-management/legacy/tunnels/<profile>.token
```

If needed:

```bash
chmod 600 <credential-file>
```

## Wrong client/account confusion

```bash
cfm list
cfm account list
cfm tunnel list company-a
```

Account alias `company-a` and Tunnel/profile alias `company-a` may intentionally coexist but are different resource types until adoption.

## Reporting a bug

Include sanitized output from:

```bash
node --version
cloudflared --version
cfm --version
cfm doctor
cfm migrate --dry-run
```

For API issues:

```bash
cfm account show <account>
cfm account doctor <account> --hostname <hostname>
```

Never post Tunnel Tokens, Account API Tokens, Authorization headers, or client secrets.
