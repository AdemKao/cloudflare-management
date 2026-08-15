# cloudflare-management

[English](./README.en.md) · [繁體中文](./README.zh-TW.md) · **日本語** · [ルート README に戻る](../README.md)

`cloudflare-management` は、1 台の開発マシンから、複数の会社・クライアントに属する **remotely-managed Cloudflare Tunnel connector** を管理するための小さなローカル CLI です。

実行コマンドは `cfm` で、`cloudflare-management` もエイリアスとして利用できます。

## なぜ必要か

このツールは、フリーランスや複数クライアントを扱う開発フローを想定しています。1 台の Mac から複数の独立した Cloudflare Account に接続する場合でも、毎回 `cloudflared tunnel login` を実行したり、アカウント credential を切り替えたり、クライアントごとの secret を混在させたりする必要がありません。

各クライアントは、自分の Cloudflare Account 内で自身の remotely-managed Tunnel を保持します。`cfm` は、その Tunnel の connector token をローカルに安全に保存し、対応する `cloudflared` process の起動・停止・状態確認だけを担当します。

## 必要要件

- macOS または Linux
- Node.js 20+
- `cloudflared` がインストール済みで `PATH` から実行可能
- 各クライアントの Cloudflare Dashboard に remotely-managed Cloudflare Tunnel が作成済み

macOS + Homebrew の場合：

```bash
brew install cloudflared
```

## インストール

### GitHub から直接インストール

この機能が `main` にマージされた後：

```bash
npm install -g github:AdemKao/cloudflare-management
```

インストール確認：

```bash
cfm --version
cfm --help
```

### PR マージ前に feature branch をインストール

```bash
npm install -g github:AdemKao/cloudflare-management#feat/local-cli
```

### ローカル開発

```bash
git clone https://github.com/AdemKao/cloudflare-management.git
cd cloudflare-management
npm link
```

これで `cfm` がグローバルコマンドとして利用でき、実体はローカル checkout を参照します。

解除する場合：

```bash
npm unlink -g cloudflare-management
```

## Cloudflare の設定

会社・クライアントごとに次を行います。

1. 対象クライアントの Cloudflare Account を開く。
2. Dashboard で **remotely-managed Cloudflare Tunnel** を作成する。
3. Published Application の hostname と localhost service を設定する。
4. Tunnel を開き、**Add a replica** のインストールコマンドから connector token を取得する。
5. `cfm add` で token をローカルに登録する。

例：

```text
Company A Cloudflare account
└── company-a-dev tunnel
    ├── api-dev.company-a.com     -> http://localhost:3001
    └── hook-dev.company-a.com    -> http://localhost:3002

Company B Cloudflare account
└── company-b-dev tunnel
    └── api-dev.company-b.com     -> http://localhost:4001

Company C Cloudflare account
└── company-c-dev tunnel
    ├── app-dev.company-c.com     -> http://localhost:5001
    └── webhook-dev.company-c.com -> http://localhost:5002
```

Cloudflare Account と Domain は互いに分離されたままです。`cfm` はローカルの connector process だけを管理します。

## 初回セットアップ

ローカルディレクトリを初期化します。

```bash
cfm init
```

クライアント / 会社 profile を追加します。

```bash
cfm add claire
```

CLI は Tunnel token の入力を要求しますが、terminal には表示しません。

既存の token file から取り込むこともできます。

```bash
cfm add client-b --token-file ~/Downloads/client-b.token
```

Token は次の場所にコピーされます。

```text
~/.config/cloudflare-management/secrets/<name>.token
```

Token file の権限は `600` です。

## コマンド

```bash
# local tunnel profile の追加 / 削除
cfm add claire
cfm remove claire

# profile と process 状態の確認
cfm list
cfm status
cfm status claire

# 単一クライアント tunnel の起動 / 停止
cfm start claire
cfm stop claire
cfm restart claire

# すべての tunnel を起動 / 停止
cfm start-all
cfm stop-all

# Logs
cfm logs claire
cfm logs claire --follow

# Diagnostics
cfm doctor
cfm doctor claire

# Config file の場所を表示
cfm config
```

例：

```text
$ cfm status
NAME       STATUS   PID
claire     running  91231
client-b   stopped  -
client-c   running  91402
```

## ローカルファイル

設定：

```text
~/.config/cloudflare-management/config.json
```

Tunnel tokens：

```text
~/.config/cloudflare-management/secrets/
```

Runtime state と logs：

```text
~/.local/state/cloudflare-management/
├── logs/
└── runtime/
```

`XDG_CONFIG_HOME` と `XDG_STATE_HOME` が設定されている場合は、そのパスを利用します。

## セキュリティモデル

- Tunnel token は **Git repository に保存しません**。
- Token はローカルファイルに保存し、権限は `600` です。
- `cfm start` は `cloudflared tunnel run --token-file ...` を使用するため、token を process command line に直接載せません。
- Cloudflare Account が異なる場合は、クライアント / security boundary ごとに別の remotely-managed Tunnel を使用することを推奨します。
- Cloudflare Tunnel token は機密 credential です。アクセスを削除する場合は Cloudflare 側で rotate / revoke してください。

## v0.1 の範囲

初期バージョンでは、高権限の Cloudflare API token を要求せず、DNS や route も自動作成しません。

Cloudflare Dashboard が担当：

- Tunnel 作成
- Published Application routes
- DNS / Domain 設定
- Token rotate / revoke

`cfm` が担当：

- ローカル token 保存
- `cloudflared` connector の起動 / 停止
- Status
- Logs
- Diagnostics

Dashboard での手動 route 管理が将来的にボトルネックになった場合のみ、Cloudflare API integration を追加できます。

## 開発

```bash
npm run check
```

Syntax check と Node test suite を実行します。

## 追加ドキュメント

- [Architecture](./ARCHITECTURE.md)
- [Security](./SECURITY.md)
