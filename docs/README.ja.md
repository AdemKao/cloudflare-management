<div align="center">

# ☁️ Cloudflare Management

**1 台の開発マシンから、複数クライアントの Cloudflare Tunnel を安全に管理・作成・公開します。**

複数の会社やクライアントを扱う開発者、フリーランス、コンサルタント向けの軽量 CLI です。公式 `cloudflared` connector と Cloudflare API を使い、再現性が高く権限境界の明確なワークフローを提供します。

[English](../README.md) · [繁體中文](./README.zh-TW.md) · **日本語**

[![CI](https://github.com/AdemKao/cloudflare-management/actions/workflows/ci.yml/badge.svg)](https://github.com/AdemKao/cloudflare-management/actions/workflows/ci.yml)
![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20-339933?logo=node.js&logoColor=white)
![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Linux-lightgrey)
![License](https://img.shields.io/badge/license-MIT-blue)

</div>

---

> この日本語版は root `README.md` と同じ情報構造を維持し、install / upgrade / security / Quick Start を同期します。

## なぜこのツールが必要か

複数の会社を扱うと、Cloudflare Account、Domain、Tunnel Token、API Token、localhost port、`cloudflared` process も複数になります。

```text
Developer machine
      │
     cfm
      │
 ┌────┼───────────────┐
 ▼    ▼               ▼
A     B               C
│     │               │
Cloudflare Account A  Cloudflare Account B  Cloudflare Account C
│                     │                     │
Tunnels / routes      Tunnels / routes      Tunnels / routes
│                     │                     │
cloudflared            cloudflared            cloudflared
│                     │                     │
localhost             localhost             localhost
```

`cfm` は **`cloudflared` を置き換えません**。Tunnel protocol も再実装しません。

## 2 つの動作モード

### 1. Tunnel Token モード — 最小権限

```bash
cfm add company-a
cfm start company-a
```

Account API Token は不要です。v0.3 では Account に未紐付けの token-only profile は `legacy/tunnels/` に保存され、explicit adoption まで Account directory には入りません。

### 2. Account API モード — 任意の provisioning

```bash
cfm account add company-a
cfm tunnel create company-a project-dev
cfm route add company-a project-dev \
  --hostname api-dev.example.com \
  --url http://localhost:3001 \
  --dns
cfm start project-dev
```

Account API Token と Tunnel Token は別々に保存し、所有する Account directory の下に整理します。

## 主な特徴

- **Multi-account isolation** — Account ごとに local credential boundary を分離。
- **Account-scoped storage** — `accounts/<account>/api-token` と `accounts/<account>/tunnels/*.token`。
- **Backward compatibility** — v0.1 / v0.2 profile alias を維持。
- **安全な schema v3 migration** — backup、recovery、conflict protection。
- **Migration preview** — `cfm migrate --dry-run`。
- **Self-upgrade** — v0.3+ では `cfm upgrade`。
- **Installer abstraction** — 現在の npm/GitHub distribution と将来の Homebrew formula に対応できる設計。
- **Explicit adoption** — duplicate remote Tunnel を作らず既存 Tunnel を Account に紐付け。
- Tunnel provisioning、hostname routes、任意 DNS automation、Zone discovery。
- Tunnel / Zone / DNS を分けた permission diagnostics。
- `cfm expose` による 1 コマンド workflow。
- mode `0600` credential file、raw Tunnel Token を process args に置かない設計。
- runtime npm dependency なし。

## 必要要件

- macOS または Linux
- Node.js 20+
- `cloudflared` が `PATH` から実行可能
- 使用モードに応じた Cloudflare 権限

macOS：

```bash
brew install cloudflared
```

## インストール

最新 `main`：

```bash
npm install -g github:AdemKao/cloudflare-management
```

v0.3.0：

```bash
npm install -g github:AdemKao/cloudflare-management#v0.3.0
```

確認：

```bash
cfm --version
cfm --help
```

> Homebrew distribution は今後の予定です。v0.3 に Homebrew updater adapter があることは formula/tap が公開済みという意味ではありません。

## バージョン更新

### v0.2.x から最初の 1 回

```bash
npm install -g github:AdemKao/cloudflare-management#v0.3.0
cfm --version
cfm migrate --dry-run
cfm migrate
```

### v0.3 以降

```bash
cfm upgrade
```

Preview：

```bash
cfm upgrade --dry-run
```

確認省略：

```bash
cfm upgrade --yes
```

開発中 `main`：

```bash
cfm upgrade --channel main
```

現在の npm/GitHub stable channel は最新 GitHub Release tag を解決し、その tag をインストールします。Updater は shell string interpolation を使わず、成功後に `cfm migrate` を実行します。

詳細は [Upgrade guide](./UPGRADING.ja.md) を参照してください。

## v0.3 Account-scoped storage

```text
~/.config/cloudflare-management/
├── config.json
├── backups/
│   ├── config.v1.backup.json
│   └── config.v2.backup.json
├── accounts/
│   ├── company-a/
│   │   ├── api-token
│   │   └── tunnels/
│   │       └── project-dev.token
│   └── company-b/
│       ├── api-token
│       └── tunnels/
└── legacy/
    └── tunnels/
        └── unbound-profile.token
```

API-managed Tunnel credential は所有する Account の下に配置されます。未紐付け token-only profile は `legacy/tunnels/` に残ります。

## v0.1 / v0.2 からの安全な Migration

```bash
cfm migrate --dry-run
cfm migrate
```

Migration は alias と credential value を維持しながら file path を変更します。古い metadata を置き換える前に version-specific backup を作り、途中停止から recovery でき、異なる内容の destination credential は上書きしません。

Profile command はそのままです：

```bash
cfm start company-a
cfm status company-a
cfm logs company-a
```

## Quick Start：既存 Tunnel

```bash
cfm init
cfm add company-a
cfm start company-a
cfm status company-a
```

Token-only credential：

```text
legacy/tunnels/company-a.token
```

Dashboard での Token 取得方法は [Tunnel Token ガイド](./TUNNEL_TOKEN.ja.md) を参照してください。

## Quick Start：CLI から Tunnel を作成

```bash
cfm account add company-a
cfm tunnel create company-a project-dev
```

Storage：

```text
accounts/company-a/
├── api-token
└── tunnels/
    └── project-dev.token
```

Route：

```bash
cfm route add company-a project-dev \
  --hostname api-dev.example.com \
  --url http://localhost:3001
```

DNS も管理：

```bash
cfm route add company-a project-dev \
  --hostname api-dev.example.com \
  --url http://localhost:3001 \
  --dns
```

Zone 解決順序：

```text
1. --zone-id <ZONE_ID>
2. Account defaultZoneId
3. hostname-based discovery
```

Automatic discovery には Zone Read、DNS mutation には別途 DNS Edit/Write が必要です。

### Permission diagnostics

```bash
cfm account doctor company-a
```

Basic doctor は Tunnel API のみ確認します。Zone discovery と DNS read も確認する場合：

```bash
cfm account doctor company-a \
  --hostname api-dev.example.com
```

Read-only doctor の成功は DNS write permission を保証しません。

## 既存 token-only Tunnel を Adopt

```bash
cfm account add company-a
cfm tunnel adopt company-a company-a \
  --tunnel-id <TUNNEL_UUID>
```

Token value を維持しながら：

```text
legacy/tunnels/company-a.token
```

から：

```text
accounts/company-a/tunnels/company-a.token
```

へ移動します。別の remote Tunnel は作成しません。

## 1 コマンドで公開：`cfm expose`

```bash
cfm expose company-a \
  --name project-dev \
  --hostname api-dev.example.com \
  --port 3001
```

Managed Tunnel の reuse/create、route/DNS、connector startup、public URL 出力まで行います。token-only profile を暗黙に adopt しません。

## コマンド概要

| Area | Commands |
| --- | --- |
| Lifecycle | `migrate`, `upgrade` |
| Local profiles | `init`, `add`, `remove`, `list` |
| Connector process | `start`, `stop`, `restart`, `start-all`, `stop-all`, `status`, `logs`, `doctor` |
| Accounts | `account add/list/show/doctor/remove` |
| Tunnels | `tunnel list/create/adopt/show/token/delete` |
| Routes | `route list/add/remove` |
| Orchestration | `expose` |

詳細は [Command Reference](./COMMANDS.md)。

## Security Model

- Account API Token と Tunnel Token は別 credential。
- API-managed credential は Account ごとに分離。
- 未紐付け profile は `legacy/tunnels/`。
- Credential file は `0600`。
- Raw credential は `config.json` に保存せず、通常 output に表示しない。
- Migration は異なる destination credential を上書きしない。
- Remote Tunnel deletion は confirmation / `--yes` が必要。
- `cfm upgrade` は shell interpolation を使わず、unknown/dev install を推測して置換しない。
- Account/Zone は最小 scope を推奨。

詳細は [Security](./SECURITY.md)。

## ドキュメント

- [Documentation index](./README.md)
- [English guide](./README.en.md)
- [繁體中文](./README.zh-TW.md)
- **日本語**
- [Upgrade guide](./UPGRADING.ja.md)
- [Tunnel Token guide](./TUNNEL_TOKEN.ja.md)
- [Architecture](./ARCHITECTURE.md)
- [Command Reference](./COMMANDS.md)
- [Configuration](./CONFIGURATION.md)
- [Security](./SECURITY.md)
- [Troubleshooting](./TROUBLESHOOTING.md)
- [Roadmap](./ROADMAP.md)
- [Changelog](../CHANGELOG.md)

## 開発

```bash
git clone https://github.com/AdemKao/cloudflare-management.git
cd cloudflare-management
npm link
npm run check
```

## Scope

`cfm` は Cloudflare Tunnel workflow に特化した CLI であり、汎用 Cloudflare administration CLI ではありません。Account、Zone、Tunnel、remote configuration、DNS、Access policy、credential lifecycle の source of truth は Cloudflare です。

## License

[MIT](../LICENSE) © 2026 Adem Kao
