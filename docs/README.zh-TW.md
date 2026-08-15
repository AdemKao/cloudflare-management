# cloudflare-management

[English](./README.en.md) · **繁體中文** · [日本語](./README.ja.md) · [回到主 README](../README.md)

`cloudflare-management`（`cfm`）是一個用來管理 Cloudflare Tunnel 的本機 CLI。v0.2 除了保留原本的 Tunnel Token 模式，也新增可選的 Cloudflare Account API 模式，讓你可以直接從 CLI 建立 Tunnel、設定 hostname → localhost route，以及選擇性管理 DNS。

## 兩種使用模式

### Tunnel Token 模式

如果 Cloudflare 上已經有 Tunnel：

```bash
cfm add company-a
cfm start company-a
```

這個模式不需要 Cloudflare Account API Token，權限最低，也完全相容 v0.1。

### Account API 模式

如果希望從零開始由 CLI 建立 Tunnel：

```bash
cfm account add company-a
cfm tunnel create company-a solana-dev
cfm route add company-a solana-dev \
  --hostname webhook-dev.example.com \
  --url http://localhost:3001 \
  --dns
cfm start solana-dev
```

Account API Token 與 Tunnel Token 會分開保存。

## 安裝

需求：

- macOS 或 Linux
- Node.js 20+
- `cloudflared` 已安裝並存在於 `PATH`

macOS：

```bash
brew install cloudflared
```

從 `main` 安裝：

```bash
npm install -g github:AdemKao/cloudflare-management
```

在 v0.2 PR merge 前測試：

```bash
npm install -g github:AdemKao/cloudflare-management#feat/v0.2-api-management
```

確認：

```bash
cfm --version
cfm --help
```

## 已有 Tunnel：最快開始方式

先從 Cloudflare Dashboard 取得 Tunnel Token，再執行：

```bash
cfm init
cfm add company-a
cfm start company-a
cfm status company-a
```

Cloudflare Dashboard 取得 Tunnel Token 的完整路徑請看 [Tunnel Token 指南](./TUNNEL_TOKEN.zh-TW.md)。

## 沒有 Tunnel：直接用 CLI 建立

先加入 Cloudflare Account：

```bash
cfm account add company-a
```

CLI 會要求：

- Cloudflare Account ID
- Cloudflare API Token
- 可選的預設 Zone ID

也可以非互動式設定：

```bash
cfm account add company-a \
  --account-id <ACCOUNT_ID> \
  --token-file ~/.secrets/company-a-api-token \
  --zone-id <OPTIONAL_ZONE_ID>
```

建立 Tunnel：

```bash
cfm tunnel create company-a solana-dev
```

設定 hostname → localhost：

```bash
cfm route add company-a solana-dev \
  --hostname webhook-dev.example.com \
  --url http://localhost:3001
```

如果 API Token 還有對應 Zone 的 DNS Edit 權限，可以一起管理 DNS：

```bash
cfm route add company-a solana-dev \
  --hostname webhook-dev.example.com \
  --url http://localhost:3001 \
  --dns
```

## `cfm expose`

Phase 4 提供一條高階指令：

```bash
cfm expose company-a \
  --name solana-dev \
  --hostname webhook-dev.example.com \
  --port 3001
```

流程：

```text
驗證 Account API Token
        ↓
重用 adopted / provisioned Tunnel
或在沒有 local profile 時建立 Tunnel
        ↓
設定 hostname → origin
        ↓
預設管理 DNS（可用 --no-dns 關閉）
        ↓
預設啟動 cloudflared（可用 --no-start 關閉）
        ↓
輸出 public URL
```

## 已經使用過 `cfm add company-a` 怎麼辦？

這是 v0.2 的重要相容需求。

如果以前已經執行過：

```bash
cfm add company-a
```

升級 v0.2 後不需要重新輸入 Tunnel Token，也不需要 API Token：

```bash
cfm start company-a
cfm status company-a
cfm logs company-a
```

舊 profile 會遷移成：

```text
managementMode: token-only
account: null
tunnelId: null
原本 tokenFile 路徑保留
```

第一次 migration 會先備份 v1 metadata，再用 atomic write 寫入 v2 config。

## 把舊 Tunnel 納入 API 管理

如果之後想讓既有 Tunnel 也可以用 API 管理，不要建立第二條 Tunnel，而是使用 `adopt`：

```bash
cfm account add company-a
cfm tunnel adopt company-a company-a
```

如果無法唯一判斷遠端 Tunnel：

```bash
cfm tunnel adopt company-a company-a \
  --tunnel-id <TUNNEL_UUID>
```

Adoption：

- 不會建立新的 Tunnel；
- 不會預設覆蓋原本 Tunnel Token；
- 只會把既有 local profile 與 Account + Tunnel ID 建立關聯。

## Tunnel 狀態模型

```text
token-only
  手動建立 / v0.1 profile，只知道 Tunnel Token

adopted
  既有 Tunnel，後來明確加入 API 管理

provisioned
  由 cfm 透過 Cloudflare API 建立
```

## 常用指令

```bash
# 舊模式 / local connector
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

完整參數請看 [Command Reference](./COMMANDS.md)。

## 本機資料

Metadata：

```text
~/.config/cloudflare-management/config.json
```

Secrets：

```text
~/.config/cloudflare-management/secrets/
├── company-a.token
├── accounts/
│   └── company-a.api-token
└── tunnels/
    └── solana-dev.token
```

Runtime / logs：

```text
~/.local/state/cloudflare-management/
├── logs/
└── runtime/
```

如果設定 `XDG_CONFIG_HOME` / `XDG_STATE_HOME`，CLI 會遵循 XDG 路徑。

## 安全原則

- API Token 與 Tunnel Token 分開保存。
- Secret file 權限為 `0600`。
- Raw token 不會寫入 `config.json`。
- 正常指令不會輸出 raw token。
- `cloudflared` 使用 `--token-file`，不把 Tunnel Token 放進 process args。
- 遠端 Tunnel delete 需要確認或 `--yes`。
- 不同客戶應使用不同、最小權限、限定 Account / Zone 的 API Token。

詳見 [Security](./SECURITY.md)。

## 延伸文件

- [Tunnel Token 指南](./TUNNEL_TOKEN.zh-TW.md)
- [Architecture](./ARCHITECTURE.md)
- [v0.2 API Management](./V0.2_API_MANAGEMENT.md)
- [Command Reference](./COMMANDS.md)
- [Configuration](./CONFIGURATION.md)
- [Security](./SECURITY.md)
- [Troubleshooting](./TROUBLESHOOTING.md)
- [Roadmap](./ROADMAP.md)

## 開發

```bash
git clone https://github.com/AdemKao/cloudflare-management.git
cd cloudflare-management
npm link
npm run check
```
