# Upgrading `cfm`

**English** · [繁體中文](./UPGRADING.zh-TW.md) · [日本語](./UPGRADING.ja.md)

## Check the current version

```bash
cfm --version
```

## v0.3.0 bootstrap for existing v0.2.x users

`cfm upgrade` is introduced in v0.3, so v0.2.x cannot invoke it yet. Upgrade once with the existing GitHub/npm method:

```bash
npm install -g github:AdemKao/cloudflare-management#v0.3.0
cfm --version
```

Then preview the storage migration:

```bash
cfm migrate --dry-run
```

Apply it explicitly if desired:

```bash
cfm migrate
```

Any command that loads the old config will also trigger migration automatically.

## Future updates from v0.3+

Use:

```bash
cfm upgrade
```

By default it:

1. detects the install manager;
2. resolves the latest stable GitHub Release for the current npm/GitHub distribution;
3. previews local migration needs;
4. asks for confirmation;
5. updates the package;
6. invokes `cfm migrate` using the newly installed CLI.

Automation:

```bash
cfm upgrade --yes
```

Preview only:

```bash
cfm upgrade --dry-run
```

Development channel:

```bash
cfm upgrade --channel main
```

`main` is not a tagged stable release.

## Installer support

v0.3 introduces an installer abstraction.

Current supported distribution:

```text
npm executable + GitHub repository/release tags
```

The CLI also contains a Homebrew adapter so a future formula can use the same `cfm upgrade` UX. Until a formula/tap is actually published, do not treat Homebrew as an available install method simply because the adapter exists.

Manager override:

```bash
cfm upgrade --manager npm
cfm upgrade --manager brew
```

Use overrides only when automatic detection is wrong and you know how the CLI was installed.

## v0.3 storage layout

v0.3 changes **credential paths**, not credential values or profile aliases.

```text
~/.config/cloudflare-management/
├── config.json
├── backups/
│   ├── config.v1.backup.json
│   └── config.v2.backup.json
├── accounts/
│   └── company-a/
│       ├── api-token
│       └── tunnels/
│           └── project-dev.token
└── legacy/
    └── tunnels/
        └── unbound-profile.token
```

API-managed credentials now live under the Cloudflare Account that owns them. Token-only profiles remain under `legacy/tunnels/` until explicit adoption.

## v1/v2 → v3 migration behavior

Migration rules:

1. preserve Account/profile aliases;
2. preserve Account API Token and Tunnel Token values;
3. create a metadata backup before config replacement;
4. move Account API Tokens into `accounts/<account>/api-token`;
5. move adopted/provisioned Tunnel Tokens into `accounts/<account>/tunnels/`;
6. move unbound token-only profiles into `legacy/tunnels/`;
7. atomically write schema v3;
8. refuse to overwrite a destination credential with different contents.

The migration is recoverable after interruption. A partially moved credential can be recognized on the next run even while old v1/v2 metadata still points to the source path.

## Existing token-only users

If you previously used:

```bash
cfm add company-a
cfm start company-a
```

those commands still work after v0.3:

```bash
cfm start company-a
cfm status company-a
cfm logs company-a
```

The profile alias stays `company-a`; only the local Token path moves to the v0.3 layout.

## Adoption after migration

If the same existing remote Tunnel should become API-managed:

```bash
cfm account add company-a
cfm tunnel adopt company-a company-a --tunnel-id <TUNNEL_UUID>
```

The existing Token value is preserved and its file moves from:

```text
legacy/tunnels/company-a.token
```

to:

```text
accounts/company-a/tunnels/company-a.token
```

Adoption does not create another remote Tunnel.

## Manual install/update remains supported

Install the latest `main`:

```bash
npm install -g github:AdemKao/cloudflare-management
```

Pin v0.3.0:

```bash
npm install -g github:AdemKao/cloudflare-management#v0.3.0
```

Local config/credentials live outside the npm package directory, so reinstalling the package does not delete them.

## Recommended upgrade procedure

For an important machine:

```bash
cfm --version
cfm status
cfm doctor
cfm migrate --dry-run
```

Then update and verify:

```bash
cfm upgrade
cfm --version
cfm doctor
```

## Rollback considerations

You can reinstall an older package tag, but once schema v3 has been written, older CLIs that only understand schema v2 may not correctly read the new config or account-scoped paths.

Prefer a forward fix. Metadata backups are stored under:

```text
~/.config/cloudflare-management/backups/
```

Do not manually restore old metadata without also understanding where the credential files currently live.

## Troubleshooting

```bash
cfm migrate --dry-run
cfm upgrade --dry-run
```

Then see [Troubleshooting](./TROUBLESHOOTING.md).
