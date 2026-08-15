# Troubleshooting

This guide covers local connector problems and v0.2 Account/Tunnel/Route API-mode failures.

## Start here

Local connector diagnostics:

```bash
cfm doctor
cfm status company-a
cfm logs company-a
```

Account API diagnostics:

```bash
cfm account doctor company-a
```

This basic Account doctor validates Tunnel API access only. To also validate Zone discovery and DNS-read access for a hostname:

```bash
cfm account doctor company-a \
  --hostname api-dev.example.com
```

If you already know the Zone ID:

```bash
cfm account doctor company-a \
  --hostname api-dev.example.com \
  --zone-id <ZONE_ID>
```

Doctor does not mutate DNS records, so it cannot prove DNS write permission.

## `cloudflared` is not found

Confirm:

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
- token rotated or revoked;
- remote Tunnel deleted;
- connector configuration rejected.

For a token-only profile, replace the local token when appropriate:

```bash
cfm add company-a --token-file ~/Downloads/company-a-new.token --force
```

For an adopted/provisioned Tunnel managed through API mode, refresh the connector token without printing it:

```bash
cfm tunnel token company-a project-dev
```

Then restart:

```bash
cfm restart project-dev
```

## `cfm account doctor` says Tunnel API is OK but DNS still fails

This is expected when the API Token has Account-level Tunnel permission but lacks Zone-level access.

These permission areas are independent:

```text
Tunnel operations         → Account-level Tunnel permission
Automatic Zone discovery  → Zone read permission
DNS record mutation       → Zone-level DNS edit permission
```

Use:

```bash
cfm account doctor company-a \
  --hostname api-dev.example.com
```

to validate Zone discovery and DNS-read access. A successful result still does not guarantee DNS write permission because doctor intentionally does not mutate DNS records.

## `Error: Authentication error` / Cloudflare code `10000`

Cloudflare may return an API response with:

```text
HTTP status: 200
success: false
error code: 10000
message: Authentication error
```

v0.2.2 recognizes this as an authentication/authorization failure instead of treating the HTTP 200 as success.

If the failure happens during automatic Zone discovery, check:

```text
Zone -> Zone -> Read
Zone Resources -> target Zone
```

Or bypass discovery with:

```bash
--zone-id <ZONE_ID>
```

If the failure happens while reading/creating/updating DNS records, check:

```text
Zone -> DNS -> Edit
Zone Resources -> target Zone
```

Passing `--zone-id` does **not** bypass the DNS edit requirement.

## Account API returns 401

Run:

```bash
cfm account doctor company-a
```

A 401 normally means the configured API credential is invalid/expired/revoked. Create or rotate a scoped Cloudflare API Token and replace the local Account credential:

```bash
cfm account add company-a --force
```

The replacement credential is verified before it replaces the existing local token.

## Account API returns 403

The token is recognized but lacks permission for the requested resource/action.

Keep the permission areas separate:

```text
Tunnel operations         → Account-level Tunnel permission
Automatic Zone discovery  → Zone read permission
DNS record mutation       → Zone-level DNS edit permission
```

If you only need Tunnel/route configuration, do not request DNS mutation:

```bash
cfm route add company-a project-dev \
  --hostname api-dev.example.com \
  --url http://localhost:3001
```

If DNS mutation is required but you intentionally do not grant Zone Read, bypass discovery with an explicit Zone ID:

```bash
cfm route add company-a project-dev \
  --hostname api-dev.example.com \
  --url http://localhost:3001 \
  --dns \
  --zone-id <ZONE_ID>
```

For `cfm expose`, disable DNS when the token intentionally has no DNS permission:

```bash
cfm expose company-a \
  --name project-dev \
  --hostname api-dev.example.com \
  --port 3001 \
  --no-dns
```

Do not fix a 403 by automatically broadening a token to all Accounts/Zones.

## API returns 404

Check that the configured Account ID, Zone ID, and Tunnel ID belong to the same intended client/security boundary.

Useful commands:

```bash
cfm account show company-a
cfm tunnel list company-a
cfm tunnel show company-a project-dev
```

A token-only profile does not necessarily have a known remote Tunnel ID until it is explicitly adopted.

## API returns 409 / resource conflict

A local or remote resource may already exist. First inspect:

```bash
cfm list
cfm tunnel list company-a
```

If the Tunnel already exists and you previously used:

```bash
cfm add company-a
```

do **not** create another Tunnel. Adopt the existing one:

```bash
cfm tunnel adopt company-a company-a --tunnel-id <TUNNEL_UUID>
```

## API returns 429

Cloudflare is rate limiting requests. Stop repeated retry loops and retry later. `cfm` surfaces the 429 rather than hiding it.

## Cloudflare 5xx or timeout

Retry after confirming the local network is healthy. Avoid destructive retries when a create/delete result is uncertain; inspect remote state first:

```bash
cfm tunnel list company-a
```

## `cfm tunnel adopt` cannot uniquely resolve a Tunnel

Automatic adoption only accepts a unique remote-name match. If multiple/zero candidates match, specify the exact remote ID:

```bash
cfm tunnel list company-a
cfm tunnel adopt company-a company-a --tunnel-id <TUNNEL_UUID>
```

Adoption does not create another Tunnel and preserves the existing local Tunnel Token by default.

## Existing v0.1 profile stopped working after upgrade

A profile created with:

```bash
cfm add company-a
```

should migrate to `token-only` and keep its existing token path.

Inspect:

```bash
cfm list
cfm doctor company-a
cfm config
```

During the first v1 → v2 migration, metadata backup is stored at:

```text
~/.config/cloudflare-management/config.v1.backup.json
```

Do not delete or replace the existing Tunnel Token while diagnosing migration problems.

## `cfm route ... --dns` says Zone discovery was denied

Starting with v0.2.1, `cfm` can discover the Zone automatically when neither `--zone-id` nor an account `defaultZoneId` is configured. v0.2.2 improves authorization detection and error messages.

The resolution order is:

```text
1. --zone-id <ZONE_ID>
2. account defaultZoneId
3. automatic hostname-based Zone discovery
```

Automatic discovery calls Cloudflare `GET /zones` and requires Zone read access for the target Zone. If the token lacks that permission, `cfm` returns actionable guidance before changing the Tunnel route.

You have three choices:

1. grant narrowly-scoped Zone Read for the target Zone;
2. pass `--zone-id <ZONE_ID>` explicitly;
3. omit `--dns` and manage DNS separately.

Explicit Zone ID:

```bash
cfm route add company-a project-dev \
  --hostname api-dev.example.com \
  --url http://localhost:3001 \
  --dns \
  --zone-id <ZONE_ID>
```

Route only:

```bash
cfm route add company-a project-dev \
  --hostname api-dev.example.com \
  --url http://localhost:3001
```

## `cfm route ... --dns` cannot find a matching Zone

`cfm` checks the full hostname and then parent domains. For example:

```text
api-dev.example.com
       ↓
example.com
```

If no accessible matching Zone is returned, confirm that:

- the hostname belongs to a Zone in the configured Cloudflare Account;
- the API Token can read that Zone;
- you are using the intended Account alias.

You can always bypass discovery with:

```bash
--zone-id <ZONE_ID>
```

## `cfm expose` refuses a token-only profile

This is intentional safety behavior. `cfm expose` will not silently guess which remote Tunnel belongs to an old local token.

Explicitly adopt first:

```bash
cfm account add company-a
cfm tunnel adopt company-a company-a --tunnel-id <TUNNEL_UUID>
```

Then re-run `cfm expose`.

## Tunnel is running but the public hostname returns an error

Confirm connector state:

```bash
cfm status project-dev
cfm logs project-dev
```

Check the local origin directly:

```bash
curl -i http://localhost:3001
```

Inspect configured routes:

```bash
cfm route list company-a project-dev
```

If DNS was expected, verify the hostname resolves to the Tunnel target in the intended Zone.

## Public hostname returns 404

Possible causes:

- hostname route missing/wrong;
- hostname belongs to another Tunnel/Account;
- backend path does not exist;
- request fell through to the Tunnel catch-all rule.

Test the exact application path locally first:

```bash
curl -i http://localhost:3001/webhooks/example
```

## Public hostname returns 502 / Bad Gateway

The Tunnel can be connected while the configured origin is unavailable.

Check:

```bash
lsof -i :3001
curl -i http://localhost:3001
cfm logs project-dev
```

Then compare with:

```bash
cfm route list company-a project-dev
```

## Token permission warning

```bash
cfm doctor company-a
```

If a Tunnel Token file is broader than `0600`, restrict it:

```bash
chmod 600 ~/.config/cloudflare-management/secrets/company-a.token
```

Account API Token files should also remain private.

## Wrong client/account confusion

Use explicit aliases and inspect both namespaces:

```bash
cfm list
cfm account list
cfm tunnel list company-a
```

Remember that Account alias `company-a` and Tunnel/profile alias `company-a` may intentionally coexist but represent different resource types.

## Webhook provider cannot reach your local endpoint

Verify layers separately:

```text
Webhook provider
      ↓
public hostname / DNS
      ↓
Cloudflare edge
      ↓
Tunnel connector
      ↓
localhost service
      ↓
exact application route
```

Suggested sequence:

```bash
curl -i http://localhost:3001/webhooks/provider
cfm status project-dev
cfm logs project-dev
cfm route list company-a project-dev
curl -i https://your-dev-hostname.example.com/webhooks/provider
```

Only after these layers work should you debug provider-specific signature/payload handling.

## `cfm logs --follow` does not work

Follow mode uses the local `tail` command. The supported targets are macOS and Linux.

```bash
which tail
```

## Reporting a bug

Include:

```bash
node --version
cloudflared --version
cfm --version
cfm doctor
```

For API issues also include sanitized output from:

```bash
cfm account show <account>
```

For Zone/DNS issues, include the sanitized command shape and the output of:

```bash
cfm account doctor <account> --hostname <hostname>
```

Never post Tunnel Tokens, Account API Tokens, Authorization headers, client secrets, or sensitive private hostnames in public issues.
