# Security

[English README](./README.en.md) · [繁體中文 README](./README.zh-TW.md) · [日本語 README](./README.ja.md)

## Security goals

The CLI is designed around client/account isolation and least privilege.

For v0.1, `cloudflare-management` does not require an account-wide Cloudflare API token. Each local profile uses only the connector token for an already-created remotely-managed Cloudflare Tunnel.

## Secret handling

Tunnel tokens are stored outside the repository under the user's local configuration directory:

```text
~/.config/cloudflare-management/secrets/<profile>.token
```

The token file is created with mode `600` so only the local user should be able to read/write it.

Tokens must never be committed to Git, pasted into source files, or embedded in checked-in shell scripts.

## Process command line

The CLI launches connectors using:

```bash
cloudflared tunnel run --token-file <path>
```

This is preferred over putting the raw Tunnel token directly in the command arguments, where it may be easier to expose through process inspection or shell history.

## Isolation model

Use a different Tunnel/profile for different client security boundaries, especially when clients use separate Cloudflare Accounts.

Recommended:

```text
Client A Cloudflare Account
└── client-a-dev Tunnel
    └── client-a token

Client B Cloudflare Account
└── client-b-dev Tunnel
    └── client-b token
```

Avoid sharing one client's Tunnel token with another client project.

## What a Tunnel token can do

Treat a Cloudflare Tunnel connector token as a secret credential. Anyone who obtains a valid token may be able to run a connector for that Tunnel.

If a token is suspected to be exposed, rotate or revoke it in the owning Cloudflare account and update the local profile.

## Offboarding

When work for a client ends:

1. Stop the local connector.
2. Remove the local `cfm` profile/token.
3. Rotate or revoke the Tunnel token in the client's Cloudflare account.
4. Remove your Cloudflare account access if it is no longer required.
5. Confirm no client tokens remain in shell history, password managers, CI secrets, or temporary files beyond the intended secret store.

## Logs

Connector logs may contain hostnames, network errors, request metadata, or other operational information. Treat logs as potentially sensitive project data and avoid uploading them to public issues without review.

## Future secret backends

The current token-file model is intentionally simple. Future versions can optionally support stronger local secret storage such as:

- macOS Keychain
- 1Password CLI
- OS-native credential stores

Any future backend should preserve client isolation and avoid requiring unnecessary Cloudflare account-wide permissions.

## Reporting security issues

Do not include live Tunnel tokens, Cloudflare API credentials, or client secrets in public GitHub issues. Revoke exposed credentials before sharing diagnostic information.
