# Configuration

`cloudflare-management` keeps local connector configuration, secrets, runtime state, and logs outside the repository.

## Default paths

Configuration and tunnel tokens:

```text
~/.config/cloudflare-management/
├── config.json
└── secrets/
    └── <profile>.token
```

Runtime state and logs:

```text
~/.local/state/cloudflare-management/
├── logs/
│   └── <profile>.log
└── runtime/
    └── <profile>.json
```

## XDG support

When `XDG_CONFIG_HOME` is set, the configuration root becomes:

```text
$XDG_CONFIG_HOME/cloudflare-management/
```

When `XDG_STATE_HOME` is set, the state root becomes:

```text
$XDG_STATE_HOME/cloudflare-management/
```

This is useful when you prefer explicit configuration/state locations or need to integrate the CLI with an existing dotfiles setup.

## `config.json`

The config file records local profile metadata and the corresponding token-file path.

A simplified example:

```json
{
  "version": 1,
  "tunnels": {
    "company-a": {
      "tokenFile": "/Users/you/.config/cloudflare-management/secrets/company-a.token",
      "createdAt": "2026-08-15T00:00:00.000Z",
      "updatedAt": "2026-08-15T00:00:00.000Z"
    }
  }
}
```

Do not manually copy real tokens into this file. Tokens belong in the dedicated secret files created by `cfm add`.

## Token files

Each profile has a dedicated token file:

```text
~/.config/cloudflare-management/secrets/company-a.token
```

The CLI writes token files with mode `600` and secret directories with restrictive permissions.

Do not commit this directory to Git or sync it into an insecure shared location.

## Runtime state

When `cfm start <name>` launches `cloudflared`, the CLI records lightweight runtime state such as the process ID and log path.

Runtime state is local and disposable. If the recorded process no longer exists, `cfm status` cleans the stale state.

## Logs

Connector stdout/stderr are appended to:

```text
~/.local/state/cloudflare-management/logs/<profile>.log
```

Read recent logs:

```bash
cfm logs company-a
```

Follow them:

```bash
cfm logs company-a --follow
```

Logs may include hostnames, connection errors, and operational metadata. Review logs before sharing them publicly.

## Recommended profile naming

Use names that describe the client/security boundary rather than a single hostname:

```text
company-a
company-b
personal-lab
```

A single remotely-managed tunnel can expose multiple hostnames for the same client, so a tunnel profile usually does not need to be named after one webhook provider or one local route.

## What is intentionally not stored

v0.1 does not store:

- account-wide Cloudflare API tokens;
- Cloudflare login credentials;
- DNS zone configuration;
- Published Application route definitions;
- Access policies.

Those remain managed in Cloudflare.

See [Security](./SECURITY.md) for the security rationale.
