<div align="center">

# ☁️ Cloudflare Management

**Manage multiple Cloudflare Tunnel connectors across independent client accounts from one machine.**

A lightweight local CLI for freelancers, consultants, and developers who work with multiple Cloudflare accounts and want a clean, repeatable way to start, stop, inspect, and troubleshoot remotely-managed tunnels.

[English](./README.md) · [繁體中文](./docs/README.zh-TW.md) · [日本語](./docs/README.ja.md)

[![CI](https://github.com/AdemKao/cloudflare-management/actions/workflows/ci.yml/badge.svg)](https://github.com/AdemKao/cloudflare-management/actions/workflows/ci.yml)
![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20-339933?logo=node.js&logoColor=white)
![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Linux-lightgrey)
![License](https://img.shields.io/badge/license-MIT-blue)

</div>

---

## Why this exists

When you work with several companies, each client should keep its own Cloudflare account, tunnel, domains, DNS, routes, and credentials.

Without a small management layer, local development often turns into repeated account logins, scattered tunnel tokens, forgotten processes, and uncertainty about which client tunnel is currently running.

`cfm` keeps those client boundaries intact while making the local workflow simple:

```text
                              Developer machine
                                     │
                                     ▼
                                    cfm
                                     │
                  ┌──────────────────┼──────────────────┐
                  │                  │                  │
                  ▼                  ▼                  ▼
             cloudflared A      cloudflared B      cloudflared C
                  │                  │                  │
                  ▼                  ▼                  ▼
          Cloudflare Account A Cloudflare Account B Cloudflare Account C
                  │                  │                  │
            Company A domain   Company B domain   Company C domain
```

Each client remains isolated. `cfm` only manages the connector token and `cloudflared` process on your development machine.

## Highlights

- **Multi-account friendly** — manage independent Cloudflare accounts without repeatedly switching `cloudflared tunnel login` credentials.
- **Client isolation** — one profile per client/security boundary.
- **Safe local token storage** — tunnel token files are stored outside the repository with mode `600`.
- **No token in the process command line** — connectors use `cloudflared tunnel run --token-file ...`.
- **Process management** — start, stop, restart, and inspect one or all configured tunnels.
- **Centralized logs** — view recent output or follow a connector log live.
- **Built-in diagnostics** — `cfm doctor` checks Node.js, `cloudflared`, token availability, token permissions, and process state.
- **XDG-aware** — honors `XDG_CONFIG_HOME` and `XDG_STATE_HOME` when set.
- **Minimal footprint** — Node.js 20+, no runtime npm dependencies.

## Quick start

### 1. Install `cloudflared`

macOS:

```bash
brew install cloudflared
```

Confirm it is available:

```bash
cloudflared --version
```

### 2. Install `cfm`

While PR #1 is still on the feature branch:

```bash
npm install -g github:AdemKao/cloudflare-management#feat/local-cli
```

After the branch is merged to `main`:

```bash
npm install -g github:AdemKao/cloudflare-management
```

Verify:

```bash
cfm --version
cfm --help
```

### 3. Create a remotely-managed tunnel in each client account

In the appropriate Cloudflare account, create the tunnel and configure its Published Application hostname(s) and localhost service(s). Then copy the connector token from the installation command.

`cfm` deliberately does **not** require a high-privilege Cloudflare API token in v0.1.

### 4. Add client profiles

```bash
cfm init
cfm add company-a
cfm add company-b
cfm add company-c
```

The interactive token prompt hides the token while you type.

You can also import an existing token file:

```bash
cfm add company-a --token-file ~/Downloads/company-a.token
```

### 5. Start and inspect a tunnel

```bash
cfm start company-a
cfm status
```

Example:

```text
NAME       STATUS   PID
company-a  running  91231
company-b  stopped  -
company-c  stopped  -
```

Follow logs when debugging a webhook or local service:

```bash
cfm logs company-a --follow
```

## Typical multi-company setup

A single machine can run connectors that belong to completely different Cloudflare accounts:

```text
Company A Cloudflare account
└── company-a-dev tunnel
    ├── api-dev.company-a.com      → http://localhost:3001
    └── webhook-dev.company-a.com  → http://localhost:3002

Company B Cloudflare account
└── company-b-dev tunnel
    └── api-dev.company-b.com      → http://localhost:4001

Company C Cloudflare account
└── company-c-dev tunnel
    ├── app-dev.company-c.com      → http://localhost:5001
    └── webhook-dev.company-c.com  → http://localhost:5002
```

Locally:

```bash
cfm start company-a
cfm start company-b
cfm start company-c
```

Or:

```bash
cfm start-all
```

## Command overview

| Command | Purpose |
| --- | --- |
| `cfm init` | Initialize local config/state directories |
| `cfm add <name>` | Add a tunnel profile and securely store its token |
| `cfm add <name> --token-file <path>` | Import a token from a local file |
| `cfm remove <name>` | Stop and remove a local tunnel profile |
| `cfm list` | List configured profiles |
| `cfm start <name>` | Start one connector |
| `cfm start-all` | Start all configured connectors |
| `cfm stop <name>` | Stop one connector |
| `cfm stop-all` | Stop all configured connectors |
| `cfm restart <name>` | Restart one connector |
| `cfm status [name]` | Show process state for one or all profiles |
| `cfm logs <name>` | Print recent connector logs |
| `cfm logs <name> --follow` | Follow connector logs live |
| `cfm doctor [name]` | Run local diagnostics |
| `cfm config` | Print the local configuration path |
| `cfm --version` | Print the CLI version |

See [Command Reference](./docs/COMMANDS.md) for details and examples.

## How it works

`cfm` does not replace Cloudflare Tunnel and does not implement the tunnel protocol itself.

It is a small management layer around the official `cloudflared` binary:

```text
cfm
 │
 ├── profile configuration
 ├── protected token files
 ├── process state
 ├── logs
 └── diagnostics
       │
       ▼
  cloudflared
       │
       ▼
 Cloudflare Tunnel
```

Cloudflare remains responsible for tunnel connectivity, DNS, routing, and edge behavior.

## Security model

Tunnel tokens are credentials. Treat them like secrets.

`cfm` currently applies these protections:

- tokens are **never stored in this repository**;
- local token files are stored under the user config directory;
- secret files are written with mode `600`;
- configuration/state directories are created with restrictive permissions;
- `cloudflared` is launched with `--token-file`, so the raw token is not embedded in the command line;
- different companies can use different profiles and independent remotely-managed tunnels;
- no account-wide Cloudflare API token is required for the v0.1 workflow.

For token rotation, client offboarding, and threat-model notes, read [Security](./docs/SECURITY.md).

## Local data

Default configuration:

```text
~/.config/cloudflare-management/
├── config.json
└── secrets/
    ├── company-a.token
    ├── company-b.token
    └── company-c.token
```

Runtime state and logs:

```text
~/.local/state/cloudflare-management/
├── logs/
└── runtime/
```

For XDG overrides and file details, see [Configuration](./docs/CONFIGURATION.md).

## Documentation

### Languages

- [English](./docs/README.en.md)
- [繁體中文](./docs/README.zh-TW.md)
- [日本語](./docs/README.ja.md)

### Guides and reference

- [Architecture](./docs/ARCHITECTURE.md)
- [Security](./docs/SECURITY.md)
- [Configuration](./docs/CONFIGURATION.md)
- [Command Reference](./docs/COMMANDS.md)
- [Troubleshooting](./docs/TROUBLESHOOTING.md)
- [Roadmap](./docs/ROADMAP.md)
- [Contributing](./CONTRIBUTING.md)

## Troubleshooting

Start with:

```bash
cfm doctor
```

Then inspect the relevant connector:

```bash
cfm status company-a
cfm logs company-a
```

Common issues such as missing `cloudflared`, invalid/rotated tokens, stale process state, hostname routing problems, and localhost services not listening are covered in [Troubleshooting](./docs/TROUBLESHOOTING.md).

## Scope of v0.1

The first release is intentionally conservative.

### `cfm` manages

- local tunnel profiles;
- local connector token files;
- `cloudflared` processes;
- status;
- logs;
- diagnostics.

### Cloudflare Dashboard manages

- tunnel creation;
- Published Application routes;
- DNS/domain configuration;
- tunnel token rotation/revocation;
- access policies and other account-level settings.

This keeps account-wide privileges out of the CLI and makes the code easier to audit.

## Roadmap

Potential future work includes:

- richer `doctor` connectivity checks;
- shell completion;
- optional structured/JSON output;
- safer interactive profile editing;
- optional Cloudflare API integration with narrowly-scoped permissions;
- package publishing and easier release distribution;
- terminal demo / documentation media.

See [Roadmap](./docs/ROADMAP.md) for the current direction.

## Development

```bash
git clone https://github.com/AdemKao/cloudflare-management.git
cd cloudflare-management
npm link
npm run check
```

Run the CLI from the local checkout:

```bash
cfm --help
```

Unlink it later with:

```bash
npm unlink -g cloudflare-management
```

Contributions are welcome. Please read [CONTRIBUTING.md](./CONTRIBUTING.md) before opening a pull request.

## License

[MIT](./LICENSE) © 2026 Adem Kao
