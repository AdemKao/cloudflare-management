# 取得 Cloudflare Tunnel Token

[English](./TUNNEL_TOKEN.en.md) · **繁體中文** · [日本語](./TUNNEL_TOKEN.ja.md)

`cfm` v0.1 使用的是 **Cloudflare Tunnel Token**，不是 Cloudflare 個人設定中的一般 **API Token**。

Tunnel Token 只用來讓 `cloudflared` connector 連上某一條 remotely-managed Tunnel。它已經綁定特定 Tunnel，因此 `cfm` 不需要另外知道 Cloudflare Account ID。

> Tunnel Token 是敏感憑證。任何取得 token 的人都可以執行該 Tunnel connector，請勿貼到 Issue、PR、Slack 公開頻道、截圖或 commit 到 Git。

## 目前 Cloudflare Dashboard 在哪裡取得？

依照 Cloudflare 2026 年目前的 Dashboard：

```text
Cloudflare Dashboard
→ 切換到正確的 Account
→ Networking
→ Tunnels
→ 選擇你的 Tunnel
→ Overview
→ Add a replica
```

接著：

1. 在 **Add a replica** 畫面找到 `cloudflared` installation command。
2. 複製整條 command 到本機文字編輯器，**不要直接執行**。
3. 找到 command 裡以 `eyJ...` 開頭的字串。
4. 只把這段 Tunnel Token 提供給 `cfm add`。

Cloudflare 官方文件：

- https://developers.cloudflare.com/tunnel/advanced/tunnel-tokens/
- https://developers.cloudflare.com/tunnel/configuration/

## 範例

Cloudflare 顯示的 command 會類似：

```bash
cloudflared tunnel run --token eyJ...
```

你需要的是：

```text
eyJ...
```

不要把整條 command 貼到 `cfm`。

加入本機 profile：

```bash
cfm add company-a
```

CLI 會出現：

```text
Tunnel token: ************
```

貼上 `eyJ...` token 後按 Enter 即可。

## 如果還沒有 Tunnel

先建立 remotely-managed Tunnel：

```text
Cloudflare Dashboard
→ Networking
→ Tunnels
→ Create a tunnel
```

建立完成後，再進入：

```text
Tunnel
→ Overview
→ Add a replica
```

取得 token。

Cloudflare 官方建立 Tunnel 文件：

- https://developers.cloudflare.com/tunnel/setup/

## 不同 Cloudflare Account 怎麼處理？

每間公司都從自己的 Cloudflare Account 取得自己的 Tunnel Token：

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

然後分別加入：

```bash
cfm add company-a
cfm add company-b
cfm add company-c
```

本機會各自保存 token，不需要反覆執行 `cloudflared tunnel login`。

## Core Dashboard 與 Cloudflare One Dashboard

Cloudflare 在 2026 年將 Tunnel 管理整合到主要 Cloudflare Dashboard。

對 `cfm` 這種 public application / webhook / local development 使用情境，建議走：

```text
Networking → Tunnels
```

如果你的 Tunnel 主要用於 Zero Trust Access、private application 或 private network，也可以在 Cloudflare One Dashboard 管理 connectors：

```text
Zero Trust → Networks → Connectors
```

Cloudflare 官方說明：

- https://developers.cloudflare.com/changelog/post/2026-02-20-tunnel-core-dashboard/

## Tunnel Token 與 API Token 的差異

| 類型 | v0.1 是否需要 | 用途 |
|---|---:|---|
| Tunnel Token | ✅ 需要 | 執行特定 remotely-managed Tunnel connector |
| Cloudflare API Token | ❌ 不需要 | 透過 API 建立 Tunnel、DNS、routes 或管理 Cloudflare 資源 |

`cfm` v0.1 刻意不要求高權限 Cloudflare API Token，降低不同公司帳號之間的權限與外洩風險。

## Token rotation

如果 token 外洩或人員離場，請直接在 Cloudflare：

```text
Networking
→ Tunnels
→ 選擇 Tunnel
→ Rotate token
```

Rotate 後，新的 connector 應改用新的 Tunnel Token。

詳細流程：

- https://developers.cloudflare.com/tunnel/advanced/tunnel-tokens/

## 安全提醒

- 不要 commit Tunnel Token。
- 不要把 token 寫進 README、`.env.example` 或 shell script。
- 不要把 token 貼到 Issue / PR。
- 每間公司應使用自己的 Tunnel / token security boundary。
- `cfm` 會將 token 保存於 `~/.config/cloudflare-management/secrets/`，並使用 `0600` 權限。
- `cfm start` 使用 `cloudflared tunnel run --token-file ...`，避免直接把 token 放在 process command line。

相關文件：

- [Security](./SECURITY.md)
- [Configuration](./CONFIGURATION.md)
- [Troubleshooting](./TROUBLESHOOTING.md)
