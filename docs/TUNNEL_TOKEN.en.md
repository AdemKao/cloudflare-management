# Get a Cloudflare Tunnel Token

**English** · [繁體中文](./TUNNEL_TOKEN.zh-TW.md) · [日本語](./TUNNEL_TOKEN.ja.md)

`cfm` v0.1 uses a **Cloudflare Tunnel Token**, not a general Cloudflare **API Token** from your profile settings.

A Tunnel Token authorizes a `cloudflared` connector to run one specific remotely-managed Tunnel. The token is already associated with that Tunnel, so `cfm` does not need a separate Cloudflare Account ID.

> Treat a Tunnel Token as a secret. Anyone who has the token can run a connector for that Tunnel. Do not paste it into issues, pull requests, public chat channels, screenshots, or Git commits.

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

Cloudflare will show a command similar to:

```bash
cloudflared tunnel run --token eyJ...
```

You need only:

```text
eyJ...
```

Do not paste the entire installation command into `cfm`.

Add a local profile:

```bash
cfm add company-a
```

The CLI prompts with:

```text
Tunnel token: ************
```

Paste the `eyJ...` token and press Enter.

## If you do not have a Tunnel yet

Create a remotely-managed Tunnel first:

```text
Cloudflare Dashboard
→ Networking
→ Tunnels
→ Create a tunnel
```

After creation, open:

```text
Tunnel
→ Overview
→ Add a replica
```

and obtain the token.

Official setup guide:

- https://developers.cloudflare.com/tunnel/setup/

## Multiple Cloudflare accounts

Get a separate Tunnel Token from each company's own Cloudflare account:

```text
Company A Cloudflare Account
└── company-a-dev
    └── Tunnel Token A

Company B Cloudflare Account
└── company-b-dev
    └── Tunnel Token B

Company C Cloudflare Account
└── company-c-dev
    └── Tunnel Token C
```

Then add them independently:

```bash
cfm add company-a
cfm add company-b
cfm add company-c
```

The local tokens are stored separately, and you do not need to repeatedly switch `cloudflared tunnel login` credentials.

## Core Dashboard vs Cloudflare One Dashboard

Cloudflare added first-class Tunnel management to the main Cloudflare Dashboard in 2026.

For public applications, webhooks, and local development with `cfm`, use:

```text
Networking → Tunnels
```

For Zero Trust Access, private applications, or private networks, connectors can also be managed in the Cloudflare One Dashboard:

```text
Zero Trust → Networks → Connectors
```

Cloudflare announcement:

- https://developers.cloudflare.com/changelog/post/2026-02-20-tunnel-core-dashboard/

## Tunnel Token vs API Token

| Credential | Needed by v0.1 | Purpose |
|---|---:|---|
| Tunnel Token | ✅ Yes | Run a specific remotely-managed Tunnel connector |
| Cloudflare API Token | ❌ No | Create/manage Tunnels, DNS, routes, and other Cloudflare resources through the API |

`cfm` v0.1 intentionally avoids high-privilege Cloudflare API tokens to reduce credential exposure and preserve account isolation between clients.

## Rotate a Tunnel Token

If a token is exposed or a developer should no longer have access, rotate it in Cloudflare:

```text
Networking
→ Tunnels
→ Select the Tunnel
→ Rotate token
```

New connector sessions should then use the replacement Tunnel Token.

Official rotation guide:

- https://developers.cloudflare.com/tunnel/advanced/tunnel-tokens/

## Security notes

- Never commit a Tunnel Token.
- Do not put it in README files, `.env.example`, or shell scripts.
- Do not paste it into issues or pull requests.
- Keep a separate Tunnel/token security boundary for each independent company.
- `cfm` stores token files under `~/.config/cloudflare-management/secrets/` with mode `0600`.
- `cfm start` uses `cloudflared tunnel run --token-file ...`, avoiding the raw token in the process command line.

Related documentation:

- [Security](./SECURITY.md)
- [Configuration](./CONFIGURATION.md)
- [Troubleshooting](./TROUBLESHOOTING.md)
