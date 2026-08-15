# cloudflare-management

**English** · [繁體中文](./docs/README.zh-TW.md) · [日本語](./docs/README.ja.md)

A small local CLI for managing multiple **remotely-managed Cloudflare Tunnel connectors** across different client/company Cloudflare accounts from one development machine.

The executable command is `cfm`, with `cloudflare-management` available as an alias.

## Use case

`cloudflare-management` is designed for freelance and multi-client development workflows where one machine may need to connect several independent Cloudflare accounts without repeatedly switching `cloudflared tunnel login` credentials.

```text
Developer Mac
    │
    └── cfm
        ├── company-a → cloudflared → Cloudflare Account A
        ├── company-b → cloudflared → Cloudflare Account B
        └── company-c → cloudflared → Cloudflare Account C
```

Each client keeps its Tunnel, domains, DNS, routes, and token lifecycle inside its own Cloudflare account. `cfm` manages only local connector tokens and `cloudflared` processes.

## Requirements

- macOS or Linux
- Node.js 20+
- `cloudflared` installed and available in `PATH`
- A remotely-managed Cloudflare Tunnel created in each client's Cloudflare account

On macOS:

```bash
brew install cloudflared
```

## Install

### Current feature branch

```bash
npm install -g github:AdemKao/cloudflare-management#feat/local-cli
```

### After merge to `main`

```bash
npm install -g github:AdemKao/cloudflare-management
```

Verify:

```bash
cfm --version
cfm --help
```

## Quick start

```bash
cfm init

cfm add company-a
cfm add company-b
cfm add company-c

cfm start company-a
cfm status
```

Common commands:

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

## Documentation

### Languages

- [English documentation](./docs/README.en.md)
- [繁體中文文件](./docs/README.zh-TW.md)
- [日本語ドキュメント](./docs/README.ja.md)

### Technical docs

- [Architecture](./docs/ARCHITECTURE.md)
- [Security](./docs/SECURITY.md)

## Security

Tunnel tokens are never stored in this repository. Local token files are stored outside the project with mode `600`, and connectors are launched with `cloudflared tunnel run --token-file ...` rather than putting the raw token directly on the process command line.

See [Security](./docs/SECURITY.md) for the full security model.

## Development

```bash
git clone https://github.com/AdemKao/cloudflare-management.git
cd cloudflare-management
npm link
npm run check
```

To unlink:

```bash
npm unlink -g cloudflare-management
```

## Current scope

v0.1 intentionally keeps Cloudflare account-wide configuration in the Cloudflare Dashboard. The CLI does not currently request a high-privilege Cloudflare API token or automatically create DNS/routes.

This keeps the first version small, easy to audit, and appropriate for managing multiple independent client accounts.
