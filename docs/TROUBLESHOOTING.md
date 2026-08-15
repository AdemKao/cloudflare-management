# Troubleshooting

This guide focuses on the most common local-development failures when using `cfm` with remotely-managed Cloudflare Tunnels.

## Start here

Run:

```bash
cfm doctor
```

Then inspect the affected profile:

```bash
cfm status company-a
cfm logs company-a
```

## `cloudflared` is not found

Symptom:

```text
cloudflared is not installed or not available in PATH.
```

Confirm:

```bash
cloudflared --version
```

On macOS with Homebrew:

```bash
brew install cloudflared
```

If the binary is installed but not found, verify your shell `PATH`.

## Tunnel exits immediately after `cfm start`

Run:

```bash
cfm logs company-a
```

Typical causes include:

- invalid or incomplete tunnel token;
- token was rotated/revoked in Cloudflare;
- the remotely-managed tunnel was deleted;
- `cloudflared` rejected the connector configuration.

If the token changed, replace the local profile using a new token:

```bash
cfm add company-a --token-file ~/Downloads/company-a-new.token --force
```

Then:

```bash
cfm restart company-a
```

## Tunnel is running but the public hostname returns an error

First confirm the connector is alive:

```bash
cfm status company-a
```

Then check the local origin directly.

For example, if Cloudflare routes to `http://localhost:3001`:

```bash
curl -i http://localhost:3001
```

If the local service is unavailable, fix the application before debugging the tunnel.

If localhost works, check the Published Application route in the correct client Cloudflare account:

```text
hostname → correct local service/port
```

Also confirm you are editing the same Cloudflare account that owns the tunnel token used by the profile.

## Public hostname returns 404

Possible causes:

- Published Application hostname is missing;
- hostname belongs to a different tunnel/account;
- application route points at the wrong localhost port;
- your backend does not implement the requested path.

For a webhook endpoint, test the exact path locally first:

```bash
curl -i http://localhost:3001/webhooks/example
```

A working tunnel cannot fix an application-level 404.

## Public hostname returns 502/Bad Gateway

This usually indicates that the tunnel reached the connector but `cloudflared` could not reach the configured local origin.

Check:

```bash
lsof -i :3001
curl -i http://localhost:3001
```

Then verify the port configured in Cloudflare.

## `cfm status` says stopped but you expected it to be running

Inspect logs:

```bash
cfm logs company-a
```

Then restart:

```bash
cfm start company-a
```

The CLI removes stale runtime state when the recorded process no longer exists.

## Token permission warning

Run:

```bash
cfm doctor company-a
```

If it warns that permissions are broader than `600`, restrict the file:

```bash
chmod 600 ~/.config/cloudflare-management/secrets/company-a.token
```

The parent secret directory should also remain private to the local user.

## Wrong client/account confusion

When working with multiple companies, use explicit profile names:

```bash
cfm list
cfm status
```

Recommended naming:

```text
company-a
company-b
company-c
```

Avoid generic names such as `dev`, `test`, or `tunnel1` when they make ownership ambiguous.

Remember: each profile token belongs to one remotely-managed tunnel in one Cloudflare account.

## Webhook provider cannot reach your local endpoint

Verify each layer separately:

```text
Webhook provider
      ↓
Public hostname
      ↓
Cloudflare edge
      ↓
Tunnel connector
      ↓
localhost service
      ↓
exact application route
```

Recommended sequence:

```bash
# 1. Local application
curl -i http://localhost:3001/webhooks/provider

# 2. Connector
cfm status company-a
cfm logs company-a

# 3. Public route
curl -i https://your-dev-hostname.example.com/webhooks/provider
```

Only after all three work should you debug provider-specific signatures or payload handling.

## `cfm logs --follow` does not work

The current implementation uses the local `tail` command for follow mode. `cfm` v0.1 targets macOS and Linux, where `tail` is normally available.

Check:

```bash
tail --version
```

On macOS, BSD `tail` does not support `--version`; simply confirm that `tail` resolves:

```bash
which tail
```

## Need more information

When reporting a bug, include:

```bash
node --version
cloudflared --version
cfm --version
cfm doctor
```

Also include the relevant error/log excerpt, but **remove tokens, client secrets, private hostnames, or other sensitive values before posting publicly**.
