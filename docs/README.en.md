# cloudflare-management

**English** · [繁體中文](./README.zh-TW.md) · [日本語](./README.ja.md) · [Back to root README](../README.md)

`cloudflare-management` (`cfm`) is a local CLI for managing Cloudflare Tunnel connectors across independent client/company Cloudflare accounts. v0.2 preserves the original Tunnel Token workflow and adds an optional Cloudflare Account API mode for provisioning Tunnels, published hostname routes, and DNS.

## Operating modes

### Tunnel Token mode

Use an existing remotely-managed Tunnel with the minimum local credential:

```bash
cfm add company-a
cfm start company-a
```

No Account API Token is required.

### Account API mode

Create/manage Cloudflare resources from the CLI:

```bash
cfm account add company-a
cfm tunnel create company-a solana-dev
cfm route add company-a solana-dev \
  --hostname webhook-dev.example.com \
  --url http://localhost:3001 \
  --dns
cfm start solana-dev
```

Account API Tokens and Tunnel Tokens are stored separately.

## Requirements and installation

- macOS or Linux
- Node.js 20+
- `cloudflared` in `PATH`

macOS:

```bash
brew install cloudflared
```

Install from `main`:

```bash
npm install -g github:AdemKao/cloudflare-management
```

Test the v0.2 implementation branch before merge:

```bash
npm install -g github:AdemKao/cloudflare-management#feat/v0.2-api-management
```

Verify:

```bash
cfm --version
cfm --help
```

## Existing Tunnel quick start

Get the connector token from Cloudflare, then:

```bash
cfm init
cfm add company-a
cfm start company-a
cfm status company-a
```

See [Tunnel Token setup](./TUNNEL_TOKEN.en.md) for the Dashboard path and security notes.

## Create a Tunnel from `cfm`

Register a narrowly-scoped Cloudflare Account credential:

```bash
cfm account add company-a
```

Non-interactive form:

```bash
cfm account add company-a \
  --account-id <ACCOUNT_ID> \
  --token-file ~/.secrets/company-a-api-token \
  --zone-id <OPTIONAL_ZONE_ID>
```

Create and configure:

```bash
cfm tunnel create company-a solana-dev

cfm route add company-a solana-dev \
  --hostname webhook-dev.example.com \
  --url http://localhost:3001
```

Add `--dns` only when the API Token has DNS permission for the required Zone.

## One-command expose workflow

```bash
cfm expose company-a \
  --name solana-dev \
  --hostname webhook-dev.example.com \
  --port 3001
```

By default this configures DNS and starts the connector. Use `--no-dns` or `--no-start` to disable those steps.

`cfm expose` reuses an `adopted` or `provisioned` profile. It will not silently adopt an existing token-only profile.

## Upgrading an existing v0.1 profile

If you already ran:

```bash
cfm add company-a
```

you can upgrade and immediately keep using:

```bash
cfm start company-a
cfm status company-a
cfm logs company-a
```

The v1 profile is migrated to schema v2 as `token-only`; the existing Tunnel Token path/value is preserved and no Account API Token is required.

To opt into API management later:

```bash
cfm account add company-a
cfm tunnel adopt company-a company-a
```

If automatic name matching is ambiguous:

```bash
cfm tunnel adopt company-a company-a --tunnel-id <TUNNEL_UUID>
```

Adoption does not create a duplicate Tunnel or replace the existing Tunnel Token by default.

## Management states

```text
token-only   existing/manual Tunnel; local Tunnel Token known
adopted      existing/manual Tunnel explicitly attached to Account + Tunnel ID
provisioned  Tunnel created by cfm through Cloudflare API mode
```

## Commands

```bash
# Local/token-only workflow
cfm add company-a
cfm list
cfm start company-a
cfm stop company-a
cfm restart company-a
cfm status
cfm logs company-a --follow
cfm doctor company-a

# Accounts
cfm account add company-a
cfm account list
cfm account show company-a
cfm account doctor company-a
cfm account remove company-a --yes

# Tunnels
cfm tunnel list company-a
cfm tunnel create company-a solana-dev
cfm tunnel adopt company-a company-a
cfm tunnel show company-a solana-dev
cfm tunnel token company-a solana-dev
cfm tunnel delete company-a solana-dev --yes

# Routes
cfm route list company-a solana-dev
cfm route add company-a solana-dev --hostname webhook-dev.example.com --url http://localhost:3001
cfm route remove company-a solana-dev --hostname webhook-dev.example.com
```

Read [Command Reference](./COMMANDS.md) for all options.

## Local data and security

```text
~/.config/cloudflare-management/
├── config.json
└── secrets/
    ├── company-a.token
    ├── accounts/
    │   └── company-a.api-token
    └── tunnels/
        └── solana-dev.token
```

```text
~/.local/state/cloudflare-management/
├── logs/
└── runtime/
```

- raw credentials are not stored in `config.json`;
- secret files use mode `0600`;
- API Tokens and Tunnel Tokens are separate;
- normal commands do not print raw tokens;
- `cloudflared` is launched with `--token-file`;
- remote Tunnel deletion requires confirmation or `--yes`;
- use specific Account/Zone scopes instead of unrestricted cross-client credentials.

See [Security](./SECURITY.md).

## Documentation

- [Tunnel Token guide](./TUNNEL_TOKEN.en.md)
- [Architecture](./ARCHITECTURE.md)
- [v0.2 API Management](./V0.2_API_MANAGEMENT.md)
- [Command Reference](./COMMANDS.md)
- [Configuration](./CONFIGURATION.md)
- [Security](./SECURITY.md)
- [Troubleshooting](./TROUBLESHOOTING.md)
- [Roadmap](./ROADMAP.md)

## Development

```bash
git clone https://github.com/AdemKao/cloudflare-management.git
cd cloudflare-management
npm link
npm run check
```
