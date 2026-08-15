# Command Reference

This page documents the `cfm` commands available in v0.1.

## Global options

```bash
cfm --help
cfm -h
cfm --version
cfm -v
```

## `cfm init`

Initialize the local configuration, secret, log, and runtime directories.

```bash
cfm init
```

Use this once after installation. Other commands also create required directories when needed, so it is safe to run more than once.

## `cfm add <name>`

Add or import a remotely-managed Cloudflare Tunnel connector token.

Interactive mode:

```bash
cfm add company-a
```

The token is entered through a hidden TTY prompt and stored outside the repository.

Import from a local token file:

```bash
cfm add company-a --token-file ~/Downloads/company-a.token
```

Replace an existing profile:

```bash
cfm add company-a --token-file ~/Downloads/company-a-new.token --force
```

Profile names may contain letters, numbers, dots, underscores, and hyphens.

## `cfm remove <name>`

Stop the connector if it is running, remove the profile, remove the locally stored token file, and remove the local connector log.

```bash
cfm remove company-a
```

This does **not** delete the tunnel from Cloudflare. Revoke or rotate the tunnel token in Cloudflare when offboarding access.

## `cfm list`

List configured local tunnel profiles.

```bash
cfm list
```

## `cfm start <name>`

Start one detached `cloudflared` connector process.

```bash
cfm start company-a
```

Internally, the connector is launched using the stored token file rather than placing the raw token on the command line.

If the connector exits immediately, `cfm` prints recent log output to help identify the cause.

## `cfm start-all`

Start every configured local profile.

```bash
cfm start-all
```

Each profile is started independently. A failure in one profile is reported without hiding the result for the others.

## `cfm stop <name>`

Stop one managed connector process.

```bash
cfm stop company-a
```

## `cfm stop-all`

Stop all managed connector processes.

```bash
cfm stop-all
```

## `cfm restart <name>`

Stop and start one connector.

```bash
cfm restart company-a
```

## `cfm status [name]`

Show the process state for all profiles:

```bash
cfm status
```

Example:

```text
NAME       STATUS   PID
company-a  running  91231
company-b  stopped  -
```

Inspect one profile:

```bash
cfm status company-a
```

`cfm` checks whether the recorded process is still alive and cleans stale runtime state when necessary.

## `cfm logs <name>`

Print recent connector logs:

```bash
cfm logs company-a
```

Follow the log live:

```bash
cfm logs company-a --follow
```

This is especially useful while testing webhooks, local APIs, or hostname routing through a tunnel.

## `cfm doctor [name]`

Run local diagnostics:

```bash
cfm doctor
```

Current checks include:

- Node.js version information;
- whether `cloudflared` exists in `PATH`;
- configuration path;
- token file readability;
- token permission warnings;
- managed process state.

Inspect a single profile:

```bash
cfm doctor company-a
```

## `cfm config`

Print the local configuration path:

```bash
cfm config
```

## Recommended debugging sequence

When a local hostname is not working:

```bash
cfm doctor company-a
cfm status company-a
cfm logs company-a
```

Then confirm that the local service itself is listening on the port configured in the Cloudflare Published Application route.

See [Troubleshooting](./TROUBLESHOOTING.md) for more detail.
