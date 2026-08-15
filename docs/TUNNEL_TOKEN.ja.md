# Cloudflare Tunnel Token の取得方法

[English](./TUNNEL_TOKEN.en.md) · [繁體中文](./TUNNEL_TOKEN.zh-TW.md) · **日本語**

`cfm` v0.1 が使用するのは **Cloudflare Tunnel Token** です。Cloudflare のプロフィール設定で作成する一般的な **API Token** ではありません。

Tunnel Token は、特定の remotely-managed Tunnel に対して `cloudflared` connector を実行するための credential です。Token 自体が Tunnel に紐づいているため、`cfm` に Cloudflare Account ID を別途設定する必要はありません。

> Tunnel Token は機密情報です。Token を持つ人はその Tunnel の connector を実行できます。Issue、PR、公開チャット、スクリーンショット、Git commit には含めないでください。

## 現在の Cloudflare Dashboard ではどこから取得する？

Cloudflare の 2026 年現在の Dashboard では、次の順に移動します。

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
2. Command をローカルのテキストエディタにコピーし、**そのまま実行しないでください**。
3. `eyJ...` で始まる文字列を探します。
4. その Tunnel Token だけを `cfm add` に入力します。

Cloudflare 公式ドキュメント：

- https://developers.cloudflare.com/tunnel/advanced/tunnel-tokens/
- https://developers.cloudflare.com/tunnel/configuration/

## 例

Cloudflare には次のような command が表示されます。

```bash
cloudflared tunnel run --token eyJ...
```

必要なのは次の部分だけです。

```text
eyJ...
```

Installation command 全体を `cfm` に貼り付けないでください。

ローカル profile を追加します。

```bash
cfm add company-a
```

CLI には次の prompt が表示されます。

```text
Tunnel token: ************
```

`eyJ...` token を貼り付けて Enter を押します。

## Tunnel がまだない場合

まず remotely-managed Tunnel を作成します。

```text
Cloudflare Dashboard
→ Networking
→ Tunnels
→ Create a tunnel
```

作成後：

```text
Tunnel
→ Overview
→ Add a replica
```

から token を取得します。

公式セットアップガイド：

- https://developers.cloudflare.com/tunnel/setup/

## 複数の Cloudflare Account を使う場合

各会社の Cloudflare Account から、それぞれ別の Tunnel Token を取得します。

```text
Company A Cloudflare Account
└── company-a-dev
    └── Tunnel Token A

Company B Cloudflare Account
└── company-b-dev
    └── Tunnel Token B

Company C Cloudflare Account
└── company-c-dev
    └── Tunnel Token C
```

それぞれを個別に追加します。

```bash
cfm add company-a
cfm add company-b
cfm add company-c
```

Token はローカルで分離して保存されるため、`cloudflared tunnel login` の credential を何度も切り替える必要はありません。

## Core Dashboard と Cloudflare One Dashboard

Cloudflare は 2026 年に Tunnel 管理をメイン Cloudflare Dashboard に統合しました。

Public application、webhook、ローカル開発で `cfm` を利用する場合は、次の経路を推奨します。

```text
Networking → Tunnels
```

Zero Trust Access、private application、private network が主目的の場合は、Cloudflare One Dashboard でも connector を管理できます。

```text
Zero Trust → Networks → Connectors
```

Cloudflare 公式アナウンス：

- https://developers.cloudflare.com/changelog/post/2026-02-20-tunnel-core-dashboard/

## Tunnel Token と API Token の違い

| Credential | v0.1 で必要？ | 用途 |
|---|---:|---|
| Tunnel Token | ✅ 必要 | 特定の remotely-managed Tunnel connector を実行する |
| Cloudflare API Token | ❌ 不要 | API から Tunnel、DNS、route などの Cloudflare resource を管理する |

`cfm` v0.1 は、高権限の Cloudflare API Token を意図的に要求しません。これにより credential の露出を減らし、会社・クライアント間の account isolation を維持します。

## Tunnel Token の rotation

Token が漏えいした場合や、開発者のアクセスを削除する場合は Cloudflare で token を rotate します。

```text
Networking
→ Tunnels
→ 対象 Tunnel を選択
→ Rotate token
```

新しい connector session では新しい Tunnel Token を使用してください。

公式ガイド：

- https://developers.cloudflare.com/tunnel/advanced/tunnel-tokens/

## セキュリティ上の注意

- Tunnel Token を Git に commit しないでください。
- README、`.env.example`、shell script に token を書かないでください。
- Issue / PR に token を貼り付けないでください。
- 独立した会社ごとに Tunnel / token の security boundary を分けてください。
- `cfm` は token file を `~/.config/cloudflare-management/secrets/` に `0600` permission で保存します。
- `cfm start` は `cloudflared tunnel run --token-file ...` を使用し、raw token を process command line に直接含めません。

関連ドキュメント：

- [Security](./SECURITY.md)
- [Configuration](./CONFIGURATION.md)
- [Troubleshooting](./TROUBLESHOOTING.md)
