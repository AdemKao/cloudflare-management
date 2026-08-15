# cloudflare-management

**English** · [繁體中文](./README.zh-TW.md) · [日本語](./README.ja.md) · [Back to root README](../README.md)

`cloudflare-management` is a small local CLI for managing multiple **remotely-managed Cloudflare Tunnel connectors** across different client/company Cloudflare accounts from one development machine.

The executable command is `cfm`, with `cloudflare-management` available as an alias.

## Why

This tool is designed for freelance and multi-client development workflows where one Mac may need to connect several independent Cloudflare accounts without repeatedly running `cloudflared tunnel login`, switching account credentials, or mixing client secrets.

Each client keeps its own remotely-managed Tunnel in its own Cloudflare account. `cfm` only stores that Tunnel's connector token locally and manages the corresponding `cloudflared` process.

## Requirements

- macOS or Linux
- Node.js 20+
- `cloudflared` installed and available in `PATH`
- A remotely-managed Cloudflare Tunnel already created in each client's Cloudflare dashboard

On macOS with Homebrew:

```bash
brew install cloudflared
```

## Install

### Install directly from GitHub

After this feature is merged to `main`:

```bash
npm install -g github:AdemKao/cloudflare-management
```

Verify the installation:

```bash
cfm --version
cfm --help
```

### Install the feature branch before merge

```bash
npm install -g github:AdemKao/cloudflare-management#feat/local-cli
```

### Develop locally

```bash
git clone https://github.com/AdemKao/cloudflare-management.git
cd cloudflare-management
npm link
```

`cfm` is now globally available while pointing to the local checkout.

To unlink later:

```bash
npm unlink -g cloudflare-management
```

## Cloudflare setup

For each company/client:

1. Open that client's Cloudflare account.
2. Create a **remotely-managed Cloudflare Tunnel** in the dashboard.
3. Configure the Published Application hostname(s) and localhost service(s) in Cloudflare.
4. Open the Tunnel and copy its connector token from the **Add a replica** installation command.
5. Add the token to `cfm`.

Example:

```text
Company A Cloudflare account
└── company-a-dev tunnel
    ├── api-dev.company-a.com     -> http://localhost:3001
    └── hook-dev.company-a.com    -> http://localhost:3002

Company B Cloudflare account
└── company-b-dev tunnel
    └── api-dev.company-b.com     -> http://localhost:4001

Company C Cloudflare account
└── company-c-dev tunnel
    ├── app-dev.company-c.com     -> http://localhost:5001
    └── webhook-dev.company-c.com -> http://localhost:5002
```

Cloudflare accounts and domains remain isolated. `cfm` only manages local connector processes.

## First-time setup

Initialize local directories:

```bash
cfm init
```

Add a client/company profile:

```bash
cfm add claire
```

The CLI prompts for the Tunnel token without echoing it to the terminal.

Or import a token from an existing local file:

```bash
cfm add client-b --token-file ~/Downloads/client-b.token
```

The token is copied to:

```text
~/.config/cloudflare-management/secrets/<name>.token
```

The token file is stored with mode `600`.

## Commands

```bash
# Add/remove local tunnel profiles
cfm add claire
cfm remove claire

# View configured profiles and process state
cfm list
cfm status
cfm status claire

# Start/stop one client tunnel
cfm start claire
cfm stop claire
cfm restart claire

# Start/stop every configured client tunnel
cfm start-all
cfm stop-all

# Logs
cfm logs claire
cfm logs claire --follow

# Diagnostics
cfm doctor
cfm doctor claire

# Show config file location
cfm config
```

Example:

```text
$ cfm status
NAME       STATUS   PID
claire     running  91231
client-b   stopped  -
client-c   running  91402
```

## Local files

Configuration:

```text
~/.config/cloudflare-management/config.json
```

Tunnel tokens:

```text
~/.config/cloudflare-management/secrets/
```

Runtime state and logs:

```text
~/.local/state/cloudflare-management/
├── logs/
└── runtime/
```

`XDG_CONFIG_HOME` and `XDG_STATE_HOME` are respected when set.

## Security model

- Tunnel tokens are **never stored in this Git repository**.
- Tokens are stored in local files with mode `600`.
- `cfm start` uses `cloudflared tunnel run --token-file ...`, so the token itself is not placed in the process command line.
- Use one remotely-managed Tunnel per client/security boundary when clients use separate Cloudflare accounts.
- A Cloudflare Tunnel token is a sensitive credential. Rotate or revoke it in Cloudflare when access should be removed.

## Scope of v0.1

This version deliberately does **not** request a high-privilege Cloudflare API token and does not create DNS/routes automatically.

Cloudflare Dashboard owns:

- Tunnel creation
- Published Application routes
- DNS/domain configuration
- Token rotation/revocation

`cfm` owns:

- Local token storage
- Starting/stopping local `cloudflared` connectors
- Status
- Logs
- Diagnostics

A future version can optionally add Cloudflare API integration if managing routes manually becomes a bottleneck.

## Development

```bash
npm run check
```

This runs syntax checks and the Node test suite.

## Additional documentation

- [Architecture](./ARCHITECTURE.md)
- [Security](./SECURITY.md)
