# Upgrading `cfm`

**English** · [繁體中文](./UPGRADING.zh-TW.md) · [日本語](./UPGRADING.ja.md)

This guide explains how to update `cloudflare-management` and what happens to existing local configuration.

## Check the current version

```bash
cfm --version
```

## Update to the latest `main`

If you installed directly from GitHub, reinstall the package:

```bash
npm install -g github:AdemKao/cloudflare-management
cfm --version
```

This replaces the globally installed CLI package but does not remove your local `cfm` data.

## Install or pin a release

```bash
npm install -g github:AdemKao/cloudflare-management#v0.2.0
cfm --version
```

Using a tag is recommended when you want reproducible developer-machine setup.

## Where your local data lives

By default:

```text
~/.config/cloudflare-management/
~/.local/state/cloudflare-management/
```

These directories are outside the global npm package installation, so updating or reinstalling the CLI does not remove profiles, Account API Tokens, Tunnel Tokens, runtime state, or logs.

## v0.1 → v0.2 migration

Existing v0.1 users may already have:

```bash
cfm add company-a
cfm start company-a
```

The first v0.2 config load:

1. reads the existing v1 metadata;
2. creates `config.v1.backup.json` before the migration write;
3. migrates existing profiles to `managementMode: token-only`;
4. preserves the existing profile aliases;
5. preserves the existing Tunnel Token file paths and values;
6. writes schema v2 atomically.

You do **not** need to re-enter the Tunnel Token or add an Account API Token to keep using the old profile.

After updating:

```bash
cfm status company-a
cfm start company-a
cfm logs company-a
```

## Optional API adoption after upgrading

If you later want `cfm` to API-manage the same existing remote Tunnel:

```bash
cfm account add company-a
cfm tunnel adopt company-a company-a --tunnel-id <TUNNEL_UUID>
```

Adoption does not create a new Tunnel and does not replace the existing Tunnel Token by default.

## Recommended pre-upgrade check

For an important development machine:

```bash
cfm --version
cfm status
cfm doctor
```

You may also make your own backup of:

```text
~/.config/cloudflare-management/config.json
```

Do not copy secret files into a public repository or shared chat.

## Rollback

To return to a tagged version:

```bash
npm install -g github:AdemKao/cloudflare-management#v0.2.0
```

Be aware that once schema v2 has been written, an older CLI that only understands schema v1 may not be suitable for reading that config. Prefer forward fixes or restore a pre-migration config backup only when you understand the consequences.

## Troubleshooting after an update

```bash
cfm --version
cfm doctor
cfm status
```

Then see [Troubleshooting](./TROUBLESHOOTING.md).
