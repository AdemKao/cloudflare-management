# cloudflare-management

[English](./README.en.md) · [繁體中文](./README.zh-TW.md) · **日本語** · [ルート README に戻る](../README.md)

`cloudflare-management`（`cfm`）は、複数の会社・クライアントの Cloudflare Tunnel を 1 台の開発マシンから管理するためのローカル CLI です。v0.2 では従来の Tunnel Token モードを維持しつつ、Cloudflare Account API を使った Tunnel 作成、hostname → origin 設定、任意の DNS 管理を追加します。

## 2 つの動作モード

### Tunnel Token モード

既存の remotely-managed Tunnel を使う場合：

```bash
cfm add company-a
cfm start company-a
```

Account API Token は不要です。v0.1 と互換性があります。

### Account API モード

CLI から Cloudflare リソースを作成・管理する場合：

```bash
cfm account add company-a
cfm tunnel create company-a solana-dev
cfm route add company-a solana-dev \
  --hostname webhook-dev.example.com \
  --url http://localhost:3001 \
  --dns
cfm start solana-dev
```

Account API Token と Tunnel Token は別々に保存されます。

## 必要要件とインストール

- macOS または Linux
- Node.js 20+
- `cloudflared` が `PATH` から実行可能

macOS：

```bash
brew install cloudflared
```

`main` からインストール：

```bash
npm install -g github:AdemKao/cloudflare-management
```

v0.2 PR をマージ前に試す場合：

```bash
npm install -g github:AdemKao/cloudflare-management#feat/v0.2-api-management
```

確認：

```bash
cfm --version
cfm --help
```

## 既存 Tunnel のクイックスタート

Cloudflare から Tunnel Token を取得した後：

```bash
cfm init
cfm add company-a
cfm start company-a
cfm status company-a
```

Dashboard での Token 取得方法は [Tunnel Token ガイド](./TUNNEL_TOKEN.ja.md) を参照してください。

## Tunnel がない場合：CLI から作成

Cloudflare Account を登録します：

```bash
cfm account add company-a
```

非対話形式：

```bash
cfm account add company-a \
  --account-id <ACCOUNT_ID> \
  --token-file ~/.secrets/company-a-api-token \
  --zone-id <OPTIONAL_ZONE_ID>
```

Tunnel を作成：

```bash
cfm tunnel create company-a solana-dev
```

hostname → localhost を設定：

```bash
cfm route add company-a solana-dev \
  --hostname webhook-dev.example.com \
  --url http://localhost:3001
```

API Token に対象 Zone の DNS Edit 権限がある場合のみ `--dns` を追加してください。

## `cfm expose`

Phase 4 の高レベルコマンド：

```bash
cfm expose company-a \
  --name solana-dev \
  --hostname webhook-dev.example.com \
  --port 3001
```

デフォルトでは DNS 設定と connector 起動まで行います。

```text
--no-dns    DNS を変更しない
--no-start  cloudflared を起動しない
```

`cfm expose` は `adopted` / `provisioned` Tunnel を再利用します。`token-only` profile を暗黙的に adopt することはありません。

## すでに `cfm add company-a` を使っている場合

v0.1 で：

```bash
cfm add company-a
```

を実行済みでも、v0.2 へアップグレード後そのまま利用できます：

```bash
cfm start company-a
cfm status company-a
cfm logs company-a
```

既存 profile は schema v2 へ次のように移行されます：

```text
managementMode: token-only
account: null
tunnelId: null
既存 tokenFile のパスを維持
```

Tunnel Token の再入力や Account API Token は不要です。

## 既存 Tunnel を API 管理へ移行

新しい Tunnel を作らずに `adopt` します：

```bash
cfm account add company-a
cfm tunnel adopt company-a company-a
```

自動判定が一意でない場合：

```bash
cfm tunnel adopt company-a company-a \
  --tunnel-id <TUNNEL_UUID>
```

Adoption は既存 Tunnel Token をデフォルトで置き換えません。

## Tunnel の管理状態

```text
token-only   手動 / v0.1 Tunnel。ローカル Tunnel Token のみ既知
adopted      既存 Tunnel を Account + Tunnel ID に明示的に関連付け
provisioned  cfm が Cloudflare API から作成した Tunnel
```

## 主なコマンド

```bash
# Local / token-only
cfm add company-a
cfm list
cfm start company-a
cfm stop company-a
cfm restart company-a
cfm status
cfm logs company-a --follow
cfm doctor company-a

# Account
cfm account add company-a
cfm account list
cfm account show company-a
cfm account doctor company-a
cfm account remove company-a --yes

# Tunnel
cfm tunnel list company-a
cfm tunnel create company-a solana-dev
cfm tunnel adopt company-a company-a
cfm tunnel show company-a solana-dev
cfm tunnel token company-a solana-dev
cfm tunnel delete company-a solana-dev --yes

# Route
cfm route list company-a solana-dev
cfm route add company-a solana-dev --hostname webhook-dev.example.com --url http://localhost:3001
cfm route remove company-a solana-dev --hostname webhook-dev.example.com
```

詳細は [Command Reference](./COMMANDS.md) を参照してください。

## ローカルデータとセキュリティ

```text
~/.config/cloudflare-management/
├── config.json
└── secrets/
    ├── company-a.token
    ├── accounts/
    │   └── company-a.api-token
    └── tunnels/
        └── solana-dev.token
```

```text
~/.local/state/cloudflare-management/
├── logs/
└── runtime/
```

- Secret file は `0600`。
- API Token と Tunnel Token は分離。
- Raw token は `config.json` に保存しない。
- 通常コマンドは raw token を表示しない。
- `cloudflared` は `--token-file` で起動。
- Remote Tunnel の削除には確認または `--yes` が必要。
- クライアントごとに Account / Zone を限定した最小権限 Token を推奨。

詳細は [Security](./SECURITY.md) を参照してください。

## ドキュメント

- [Tunnel Token ガイド](./TUNNEL_TOKEN.ja.md)
- [Architecture](./ARCHITECTURE.md)
- [v0.2 API Management](./V0.2_API_MANAGEMENT.md)
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
