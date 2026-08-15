# 取得 Cloudflare Tunnel Token

[English](./TUNNEL_TOKEN.en.md) · **繁體中文** · [日本語](./TUNNEL_TOKEN.ja.md)

`cfm` 的 **Tunnel Token 模式**使用 Cloudflare Tunnel Token；這和 Cloudflare Account API 模式使用的 **API Token** 是不同的 credential。

Tunnel Token 只用來讓 `cloudflared` connector 連上某一條 remotely-managed Tunnel。它已經綁定特定 Tunnel，因此單純使用 `cfm add <profile>` 時不需要 Cloudflare Account ID。

> Tunnel Token 是敏感憑證。任何取得 token 的人都可以執行該 Tunnel connector，請勿貼到 Issue、PR、公開聊天頻道、截圖或 commit 到 Git。

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

v0.2 有兩種方式。

### 方式 A：Cloudflare Dashboard 建立

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

取得 Tunnel Token，再執行：

```bash
cfm add company-a
```

### 方式 B：直接由 `cfm` 建立

先設定具備最小權限的 Account API Token：

```bash
cfm account add company-a
```

再建立 Tunnel：

```bash
cfm tunnel create company-a project-dev
```

這個流程會由 `cfm` 取得並安全保存 Tunnel Token，不需要再手動從 Dashboard 複製。

Cloudflare 官方建立 Tunnel 文件：

- https://developers.cloudflare.com/tunnel/setup/

## 不同 Cloudflare Account 怎麼處理？

每間公司都應使用自己的 Cloudflare Account 與 credential：

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

Tunnel Token 模式可以分別加入：

```bash
cfm add company-a
cfm add company-b
cfm add company-c
```

本機會各自保存 token，不需要反覆執行 `cloudflared tunnel login`。

## Core Dashboard 與 Cloudflare One Dashboard

Cloudflare 在 2026 年將 Tunnel 管理整合到主要 Cloudflare Dashboard。

對 public application / webhook / local development 使用情境，可使用：

```text
Networking → Tunnels
```

如果 Tunnel 主要用於 Zero Trust Access、private application 或 private network，也可以在 Cloudflare One Dashboard 管理 connectors：

```text
Zero Trust → Networks → Connectors
```

Cloudflare 官方說明：

- https://developers.cloudflare.com/changelog/post/2026-02-20-tunnel-core-dashboard/

## Tunnel Token 與 API Token 的差異

| Credential | Tunnel Token 模式 | Account API 模式 | 用途 |
|---|---:|---:|---|
| Tunnel Token | ✅ 需要 | ✅ 由 `cfm` 取得並保存 | 執行特定 remotely-managed Tunnel connector |
| Cloudflare API Token | ❌ 不需要 | ✅ 需要 | 透過 API 建立/管理 Tunnel、route，以及選擇性管理 DNS |

如果只需要啟動既有 Tunnel，Tunnel Token 模式仍然是最低權限的選擇。只有在需要由 CLI 建立或管理 Cloudflare remote resource 時，才需要 Account API Token。

## Token rotation

如果 token 外洩或人員離場，請直接在 Cloudflare：

```text
Networking
→ Tunnels
→ 選擇 Tunnel
→ Rotate token
```

Rotate 後，如果該 profile 已進入 API 管理，可以同步目前 Tunnel Token：

```bash
cfm tunnel token company-a project-dev
```

正常指令不會印出 raw token。

詳細流程：

- https://developers.cloudflare.com/tunnel/advanced/tunnel-tokens/

## 安全提醒

- 不要 commit Tunnel Token。
- 不要把 token 寫進 README、`.env.example` 或 shell script。
- 不要把 token 貼到 Issue / PR。
- 每間公司應使用自己的 Tunnel / token security boundary。
- `cfm` 會將 secret 保存於 `~/.config/cloudflare-management/` 下的受保護路徑，並使用 `0600` 權限。
- `cfm start` 使用 `cloudflared tunnel run --token-file ...`，避免直接把 token 放在 process command line。
- Account API Token 與 Tunnel Token 分開保存。

相關文件：

- [繁體中文 README](./README.zh-TW.md)
- [升級指南](./UPGRADING.zh-TW.md)
- [Security](./SECURITY.md)
- [Configuration](./CONFIGURATION.md)
- [Troubleshooting](./TROUBLESHOOTING.md)
