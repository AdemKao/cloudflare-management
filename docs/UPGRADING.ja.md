# `cfm` のアップグレード

[English](./UPGRADING.en.md) · [繁體中文](./UPGRADING.zh-TW.md) · **日本語**

このガイドでは `cloudflare-management` の更新方法と、既存のローカル設定がアップグレード時にどう扱われるかを説明します。

## 現在のバージョンを確認

```bash
cfm --version
```

## 最新の `main` へ更新

```bash
npm install -g github:AdemKao/cloudflare-management
cfm --version
```

## 特定 Release をインストール / 固定

```bash
npm install -g github:AdemKao/cloudflare-management#v0.2.2
cfm --version
```

## v0.2.2 権限診断

Cloudflare は HTTP 200 でも `success: false` と error code `10000`（`Authentication error`）を返すことがあります。v0.2.2 はこれを authentication/authorization failure として認識し、Zone discovery または DNS record access のどこで失敗したかを明示します。

基本 doctor は Tunnel API access のみ確認します：

```bash
cfm account doctor company-a
```

Zone discovery と DNS read も確認する場合：

```bash
cfm account doctor company-a \
  --hostname api-dev.example.com
```

Doctor は DNS を変更しないため、成功しても DNS Edit permission までは保証しません。

## v0.2.1 の DNS 動作

DNS 管理時の Zone ID 解決順序：

```text
1. --zone-id <ZONE_ID>
2. Account の defaultZoneId
3. hostname から自動検出
```

自動検出には対象 Zone の Zone Read、DNS record の作成・更新には DNS Edit が必要です。Zone Read を付与しない場合は `--zone-id <ZONE_ID>` を明示できますが、DNS Edit は引き続き必要です。

## ローカルデータの保存場所

```text
~/.config/cloudflare-management/
~/.local/state/cloudflare-management/
```

これらは npm global package directory の外にあるため、CLI の更新や再インストールでは profile、Account API Token、Tunnel Token、runtime state、logs は削除されません。

## v0.1 → v0.2 Migration

以前に：

```bash
cfm add company-a
cfm start company-a
```

を使っていた場合、v0.2 が最初に config を読み込むと：

1. 既存 v1 metadata を読み込みます。
2. migration write の前に `config.v1.backup.json` を作成します。
3. 既存 profile を `managementMode: token-only` へ移行します。
4. profile alias を維持します。
5. Tunnel Token file の path と内容を維持します。
6. schema v2 を atomic write します。

Tunnel Token の再入力や Account API Token の追加は不要です。

更新後：

```bash
cfm status company-a
cfm start company-a
cfm logs company-a
```

## 更新後に既存 Tunnel を API 管理へ移行する場合

```bash
cfm account add company-a
cfm tunnel adopt company-a company-a --tunnel-id <TUNNEL_UUID>
```

Adoption は新しい Tunnel を作成せず、既存 Tunnel Token もデフォルトでは置き換えません。

## 更新前の推奨チェック

```bash
cfm --version
cfm status
cfm doctor
```

## Rollback

```bash
npm install -g github:AdemKao/cloudflare-management#v0.2.2
```

schema v2 が一度書き込まれた後は、schema v1 だけを理解する古い CLI がその config を正しく扱えない可能性があります。通常は forward fix を優先してください。

## 更新後のトラブルシューティング

```bash
cfm --version
cfm doctor
cfm status
cfm account doctor company-a --hostname api-dev.example.com
```

その後 [Troubleshooting](./TROUBLESHOOTING.md) を参照してください。
