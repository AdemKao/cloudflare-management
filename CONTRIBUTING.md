# Contributing to Cloudflare Management

Thanks for your interest in improving `cloudflare-management`.

This project intentionally keeps a small surface area: it manages local `cloudflared` connector processes and credentials without taking ownership of account-wide Cloudflare configuration.

## Before you start

Please check the current scope in the README and roadmap before implementing a large feature.

Good contributions include:

- bug fixes;
- tests;
- documentation improvements;
- cross-platform fixes for macOS/Linux;
- safer local secret handling;
- better diagnostics;
- small CLI usability improvements.

Features that require broad Cloudflare account permissions should be discussed first.

## Development setup

Requirements:

- Node.js 20+;
- `cloudflared` available in `PATH` for end-to-end local testing.

Clone and link the CLI:

```bash
git clone https://github.com/AdemKao/cloudflare-management.git
cd cloudflare-management
npm link
```

Run checks:

```bash
npm run check
```

Try the local CLI:

```bash
cfm --help
cfm doctor
```

## Branches

Create a focused branch from `main`, for example:

```text
feat/json-output
fix/stale-process-state
docs/troubleshooting
```

Keep each pull request focused on one logical change.

## Tests

For behavior changes, add or update tests whenever practical.

Before opening a pull request:

```bash
npm run check
```

The same checks run in GitHub Actions.

## Security requirements

Never commit:

- Cloudflare Tunnel tokens;
- Cloudflare API tokens;
- account credentials;
- real client secrets;
- private configuration copied from a client environment.

Use fake/example values in tests and documentation.

Do not weaken token file permissions or move secrets into project-local files without a security review.

See [docs/SECURITY.md](./docs/SECURITY.md).

## Documentation

If you add or change a user-facing command, update:

- `README.md` when the change affects the quick-start or high-level workflow;
- `docs/COMMANDS.md` for command details;
- localized READMEs when the behavior change materially affects installation or usage.

## Pull request checklist

Before requesting review, confirm that:

- the change is scoped and understandable;
- `npm run check` passes;
- secrets are not included;
- user-facing behavior is documented;
- error messages are actionable;
- backward compatibility has been considered.

## Design principles

When choosing between implementations, prefer:

1. small and auditable code;
2. least privilege;
3. explicit client/account isolation;
4. predictable local state;
5. actionable diagnostics;
6. minimal runtime dependencies.

Thank you for contributing.
