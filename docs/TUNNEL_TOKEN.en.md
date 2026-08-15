# Get a Cloudflare Tunnel Token

**English** · [繁體中文](./TUNNEL_TOKEN.zh-TW.md) · [日本語](./TUNNEL_TOKEN.ja.md)

`cfm` **Tunnel Token mode** uses a Cloudflare Tunnel Token. This is a different credential from the **API Token** used by Account API mode.

A Tunnel Token authorizes a `cloudflared` connector to run one specific remotely-managed Tunnel. It is already associated with that Tunnel, so `cfm add <profile>` does not need a separate Cloudflare Account ID.

> Treat a Tunnel Token as a secret. Anyone who has it can run a connector for that Tunnel. Do not paste it into issues, pull requests, public chat channels, screenshots, or Git commits.

## Where do I get it in the current Cloudflare Dashboard?

In Cloudflare's current 2026 dashboard:

```text
Cloudflare Dashboard
→ Switch to the correct Account
→ Networking
→ Tunnels
→ Select your Tunnel
→ Overview
→ Add a replica
```

Then:

1. Find the `cloudflared` installation command in **Add a replica**.
2. Copy the command into a local text editor and **do not run it**.
3. Find the string beginning with `eyJ...`.
4. Provide only that Tunnel Token to `cfm add`.

Official Cloudflare documentation:

- https://developers.cloudflare.com/tunnel/advanced/tunnel-tokens/
- https://developers.cloudflare.com/tunnel/configuration/

## Example

Cloudflare may show:

```bash
cloudflared tunnel run --token eyJ...
```

You need only:

```text
eyJ...
```

Add a local profile:

```bash
cfm add company-a
```

The CLI prompts for the token without echoing the raw value.

## If you do not have a Tunnel yet

v0.2 supports two paths.

### Option A: create it in the Cloudflare Dashboard

```text
Cloudflare Dashboard
→ Networking
→ Tunnels
→ Create a tunnel
```

Then open **Overview → Add a replica**, copy the Tunnel Token, and run:

```bash
cfm add company-a
```

### Option B: create it directly with `cfm`

Register a least-privilege Account API credential:

```bash
cfm account add company-a
```

Then create a Tunnel:

```bash
cfm tunnel create company-a project-dev
```

`cfm` retrieves and stores the Tunnel Token securely, so no manual Dashboard copy is required.

Official setup guide:

- https://developers.cloudflare.com/tunnel/setup/

## Multiple Cloudflare accounts

Use separate credentials for each company's Cloudflare Account:

```bash
cfm add company-a
cfm add company-b
cfm add company-c
```

or, for Account API mode, create separate Account aliases and scoped API Tokens. Do not use one unrestricted credential across unrelated clients.

## Core Dashboard vs Cloudflare One Dashboard

For public applications, webhooks, and local development, Tunnel management is available at:

```text
Networking → Tunnels
```

For Zero Trust/private-network use cases, connectors can also be managed in Cloudflare One:

```text
Zero Trust → Networks → Connectors
```

Cloudflare announcement:

- https://developers.cloudflare.com/changelog/post/2026-02-20-tunnel-core-dashboard/

## Tunnel Token vs API Token

| Credential | Tunnel Token mode | Account API mode | Purpose |
|---|---:|---:|---|
| Tunnel Token | ✅ Required | ✅ Retrieved/stored by `cfm` | Run one remotely-managed Tunnel connector |
| Cloudflare API Token | ❌ Not required | ✅ Required | Create/manage Tunnels, routes, and optionally DNS through the API |

If you only need to run an existing Tunnel, Tunnel Token mode remains the lowest-privilege workflow.

## Rotate a Tunnel Token

If a token is exposed or a developer should no longer have access, rotate it in Cloudflare:

```text
Networking
→ Tunnels
→ Select the Tunnel
→ Rotate token
```

For an API-managed local profile, sync the current Tunnel Token without printing it:

```bash
cfm tunnel token company-a project-dev
```

Official rotation guide:

- https://developers.cloudflare.com/tunnel/advanced/tunnel-tokens/

## Security notes

- Never commit a Tunnel Token.
- Do not put it in README files, `.env.example`, or shell scripts.
- Do not paste it into issues or pull requests.
- Keep separate client security boundaries.
- Secret files are stored outside the repository with restrictive permissions.
- `cfm start` uses `cloudflared tunnel run --token-file ...`.
- Account API Tokens and Tunnel Tokens are stored separately.

Related documentation:

- [English README](./README.en.md)
- [Upgrade guide](./UPGRADING.en.md)
- [Security](./SECURITY.md)
- [Configuration](./CONFIGURATION.md)
- [Troubleshooting](./TROUBLESHOOTING.md)
