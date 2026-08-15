# Cloudflare Tunnel Token の取得方法

[English](./TUNNEL_TOKEN.en.md) · [繁體中文](./TUNNEL_TOKEN.zh-TW.md) · **日本語**

`cfm` の **Tunnel Token モード**では Cloudflare Tunnel Token を使用します。これは Account API モードで使用する **API Token** とは別の credential です。

Tunnel Token は特定の remotely-managed Tunnel に対して `cloudflared` connector を実行するための credential です。Token 自体が Tunnel に紐づいているため、`cfm add <profile>` だけを使う場合は Cloudflare Account ID は不要です。

> Tunnel Token は機密情報です。Issue、PR、公開チャット、スクリーンショット、Git commit には含めないでください。

## 現在の Cloudflare Dashboard ではどこから取得する？

Cloudflare の 2026 年現在の Dashboard：

```text
Cloudflare Dashboard
→ 正しい Account に切り替える
→ Networking
→ Tunnels
→ 対象 Tunnel を選択
→ Overview
→ Add a replica
```

その後：

1. **Add a replica** に表示される `cloudflared` installation command を確認します。
2. Command をローカルのテキストエディタへコピーし、**そのまま実行しないでください**。
3. `eyJ...` で始まる文字列を探します。
4. その Tunnel Token だけを `cfm add` に入力します。

公式ドキュメント：

- https://developers.cloudflare.com/tunnel/advanced/tunnel-tokens/
- https://developers.cloudflare.com/tunnel/configuration/

## 例

Cloudflare には次のような command が表示されます：

```bash
cloudflared tunnel run --token eyJ...
```

必要なのは `eyJ...` の部分だけです。

```bash
cfm add company-a
```

CLI の hidden prompt に Tunnel Token を入力します。

## Tunnel がまだない場合

v0.2 では 2 つの方法があります。

### Option A：Dashboard で作成

```text
Cloudflare Dashboard
→ Networking
→ Tunnels
→ Create a tunnel
```

作成後、**Overview → Add a replica** から Tunnel Token を取得し：

```bash
cfm add company-a
```

### Option B：`cfm` から直接作成

まず最小権限の Account API credential を登録します：

```bash
cfm account add company-a
```

その後 Tunnel を作成：

```bash
cfm tunnel create company-a project-dev
```

この場合 `cfm` が Tunnel Token を取得して安全に保存するため、Dashboard から手動コピーする必要はありません。

公式セットアップガイド：

- https://developers.cloudflare.com/tunnel/setup/

## 複数の Cloudflare Account

会社ごとに credential を分離してください。

Tunnel Token モード：

```bash
cfm add company-a
cfm add company-b
cfm add company-c
```

Account API モードでも、会社ごとに Account alias と scoped API Token を分け、関係のないクライアント間で unrestricted credential を共有しないでください。

## Core Dashboard と Cloudflare One Dashboard

Public application、webhook、local development：

```text
Networking → Tunnels
```

Zero Trust / private network：

```text
Zero Trust → Networks → Connectors
```

Cloudflare 公式アナウンス：

- https://developers.cloudflare.com/changelog/post/2026-02-20-tunnel-core-dashboard/

## Tunnel Token と API Token の違い

| Credential | Tunnel Token モード | Account API モード | 用途 |
|---|---:|---:|---|
| Tunnel Token | ✅ 必要 | ✅ `cfm` が取得・保存 | 特定の remotely-managed Tunnel connector を実行 |
| Cloudflare API Token | ❌ 不要 | ✅ 必要 | API から Tunnel / route / optional DNS を管理 |

既存 Tunnel を実行するだけなら Tunnel Token モードが最小権限です。

## Tunnel Token の rotation

Cloudflare で：

```text
Networking
→ Tunnels
→ 対象 Tunnel を選択
→ Rotate token
```

API 管理中の local profile では、raw token を表示せず同期できます：

```bash
cfm tunnel token company-a project-dev
```

公式ガイド：

- https://developers.cloudflare.com/tunnel/advanced/tunnel-tokens/

## セキュリティ上の注意

- Tunnel Token を Git に commit しない。
- README、`.env.example`、shell script に token を書かない。
- Issue / PR に token を貼り付けない。
- クライアントごとに security boundary を分ける。
- Secret file は repository 外に restrictive permission で保存される。
- `cfm start` は `cloudflared tunnel run --token-file ...` を使用する。
- Account API Token と Tunnel Token は別々に保存する。

関連ドキュメント：

- [日本語 README](./README.ja.md)
- [Upgrade guide](./UPGRADING.ja.md)
- [Security](./SECURITY.md)
- [Configuration](./CONFIGURATION.md)
- [Troubleshooting](./TROUBLESHOOTING.md)
