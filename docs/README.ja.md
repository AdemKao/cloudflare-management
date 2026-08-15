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

## なぜこのツールが必要か

複数の会社を扱うと、Cloudflare Account、Domain、Tunnel Token、API Token、localhost port、`cloudflared` process も複数になります。

`cfm` はクライアント間の security boundary を維持しながら、ローカル操作を 1 つのワークフローにまとめます。

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

既存の remotely-managed Tunnel を使う場合：

```bash
cfm add company-a
cfm start company-a
```

Account API Token は不要です。

### 2. Account API モード — 任意の provisioning

CLI から Cloudflare resource を作成・管理する場合：

```bash
cfm account add company-a
cfm tunnel create company-a project-dev
cfm route add company-a project-dev \
  --hostname api-dev.example.com \
  --url http://localhost:3001 \
  --dns
cfm start project-dev
```

Account API Token と Tunnel Token は別々に保存されます。

## 主な特徴

- 複数 Account の分離管理
- 既存 `cfm add <profile>` ユーザーとの後方互換性
- 安全な v1 → v2 migration
- duplicate Tunnel を作らない explicit adoption
- Tunnel provisioning / remote configuration
- 任意の DNS automation
- 1 コマンドの `cfm expose`
- `0600` の secret file
- raw Tunnel Token を process args に置かない設計
- `doctor` / `status` / logs
- runtime npm dependency なし

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

`main` から最新版をインストール：

```bash
npm install -g github:AdemKao/cloudflare-management
```

特定の release tag をインストール：

```bash
npm install -g github:AdemKao/cloudflare-management#v0.2.0
```

確認：

```bash
cfm --version
cfm --help
```

## バージョン更新

GitHub からインストールした場合は、`main` を再インストールすれば更新できます：

```bash
npm install -g github:AdemKao/cloudflare-management
cfm --version
```

特定 release に固定する場合：

```bash
npm install -g github:AdemKao/cloudflare-management#v0.2.0
cfm --version
```

Profile、Account API Token、Tunnel Token、runtime state、logs は npm package directory の外に保存されるため、CLI を再インストールしても削除されません。

v0.1 → v0.2 では、最初の config 読み込み時に v1 metadata をバックアップし、既存 profile を `token-only` に migration し、Tunnel Token path を維持します。

重要な開発環境を更新する前に [Upgrade guide](./UPGRADING.ja.md) を確認してください。

## Quick Start：既存 Tunnel

```bash
cfm init
cfm add company-a
cfm start company-a
cfm status company-a
```

Dashboard での Token 取得方法は [Tunnel Token ガイド](./TUNNEL_TOKEN.ja.md) を参照してください。

## Quick Start：CLI から Tunnel を作成

```bash
cfm account add company-a
cfm tunnel create company-a project-dev
cfm route add company-a project-dev \
  --hostname api-dev.example.com \
  --url http://localhost:3001
cfm start project-dev
```

DNS 権限がある場合のみ `--dns` を追加してください。

## 1 コマンドで公開：`cfm expose`

```bash
cfm expose company-a \
  --name project-dev \
  --hostname api-dev.example.com \
  --port 3001
```

デフォルトでは DNS 設定と connector 起動まで行います。無効にする場合は `--no-dns` / `--no-start` を使います。`token-only` profile を暗黙的に adopt することはありません。

## 既存 v0.1 ユーザー

以前に：

```bash
cfm add company-a
```

を実行済みでも、アップグレード後そのまま利用できます：

```bash
cfm start company-a
cfm status company-a
cfm logs company-a
```

後から API 管理へ移行する場合：

```bash
cfm account add company-a
cfm tunnel adopt company-a company-a --tunnel-id <TUNNEL_UUID>
```

Adoption は別の Tunnel を作成せず、既存 Tunnel Token もデフォルトでは置き換えません。

## コマンド概要

| Area | Commands |
| --- | --- |
| Local profiles | `init`, `add`, `remove`, `list` |
| Connector process | `start`, `stop`, `restart`, `start-all`, `stop-all`, `status`, `logs`, `doctor` |
| Accounts | `account add/list/show/doctor/remove` |
| Tunnels | `tunnel list/create/adopt/show/token/delete` |
| Routes | `route list/add/remove` |
| Orchestration | `expose` |

詳細は [Command Reference](./COMMANDS.md) を参照してください。

## Security Model

```text
~/.config/cloudflare-management/
├── config.json
└── secrets/
    ├── company-a.token
    ├── accounts/
    │   └── company-a.api-token
    └── tunnels/
        └── project-dev.token
```

- API Token と Tunnel Token は別 credential。
- Secret file は `0600`。
- Raw credential は `config.json` に保存しない。
- 通常コマンドは raw token を表示しない。
- Remote Tunnel delete は確認または `--yes` が必要。
- Account / Zone を限定した最小権限 Token を推奨。

詳細は [Security](./SECURITY.md) を参照してください。

## ドキュメント

- [Documentation index](./README.md)
- [English guide](./README.en.md)
- [繁體中文](./README.zh-TW.md)
- **日本語**
- [Upgrade guide](./UPGRADING.ja.md)
- [Tunnel Token ガイド](./TUNNEL_TOKEN.ja.md)
- [Architecture](./ARCHITECTURE.md)
- [v0.2 API Design](./V0.2_API_MANAGEMENT.md)
- [Command Reference](./COMMANDS.md)
- [Configuration](./CONFIGURATION.md)
- [Security](./SECURITY.md)
- [Troubleshooting](./TROUBLESHOOTING.md)
- [Roadmap](./ROADMAP.md)

## 開発

```bash
git clone https://github.com/AdemKao/cloudflare-management.git
cd cloudflare-management
npm link
npm run check
```

## Scope

`cfm` は Cloudflare Tunnel workflow に特化した CLI であり、汎用 Cloudflare 管理 CLI ではありません。Account、Zone、Tunnel、remote configuration、DNS、Access policy、credential lifecycle の source of truth は Cloudflare です。

## License

[MIT](../LICENSE) © 2026 Adem Kao
