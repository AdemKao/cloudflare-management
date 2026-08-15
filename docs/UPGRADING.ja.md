# `cfm` のアップグレード

[English](./UPGRADING.en.md) · [繁體中文](./UPGRADING.zh-TW.md) · **日本語**

このガイドでは `cloudflare-management` の更新方法と、既存のローカル設定がアップグレード時にどう扱われるかを説明します。

## 現在のバージョンを確認

```bash
cfm --version
```

## 最新の `main` へ更新

GitHub から直接インストールしている場合は、再インストールします：

```bash
npm install -g github:AdemKao/cloudflare-management
cfm --version
```

グローバル CLI package は更新されますが、ローカルの `cfm` data は削除されません。

## 特定 Release をインストール / 固定

```bash
npm install -g github:AdemKao/cloudflare-management#v0.2.0
cfm --version
```

複数の開発マシンで再現可能な setup が必要な場合は release tag の利用を推奨します。

## ローカルデータの保存場所

デフォルト：

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

重要な開発マシンでは：

```bash
cfm --version
cfm status
cfm doctor
```

必要に応じて次の metadata をバックアップできます：

```text
~/.config/cloudflare-management/config.json
```

Secret file を public Git repository、Issue、PR、公開チャットへ貼らないでください。

## Rollback

特定 version を再インストール：

```bash
npm install -g github:AdemKao/cloudflare-management#v0.2.0
```

schema v2 が一度書き込まれた後は、schema v1 だけを理解する古い CLI がその config を正しく扱えない可能性があります。通常は forward fix を優先し、migration 前 backup の復元は影響を理解している場合だけ行ってください。

## 更新後のトラブルシューティング

```bash
cfm --version
cfm doctor
cfm status
```

その後 [Troubleshooting](./TROUBLESHOOTING.md) を参照してください。
