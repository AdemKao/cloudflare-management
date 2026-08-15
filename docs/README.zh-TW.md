<div align="center">

# ☁️ Cloudflare Management

**在同一台開發機上，安全管理、建立並公開多個客戶 Cloudflare Account 的 Tunnel。**

給同時維護多間公司、客戶或專案的開發者、自由接案者與顧問使用；透過官方 `cloudflared` connector 與 Cloudflare API，提供一致、可重複且權限清楚的工作流程。

[English](../README.md) · **繁體中文** · [日本語](./README.ja.md)

[![CI](https://github.com/AdemKao/cloudflare-management/actions/workflows/ci.yml/badge.svg)](https://github.com/AdemKao/cloudflare-management/actions/workflows/ci.yml)
![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20-339933?logo=node.js&logoColor=white)
![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Linux-lightgrey)
![License](https://img.shields.io/badge/license-MIT-blue)

</div>

---

> 此繁體中文版與 root `README.md` 使用相同資訊架構；安裝、升級、安全、Quick Start 與主要功能應同步維護。

## 為什麼需要這個工具

同時維護多間公司時，通常也會面對多個 Cloudflare Account、Domain、Tunnel Token、API Token、localhost port，以及多個 `cloudflared` process。

`cfm` 保留不同客戶之間的安全邊界，同時把本機操作流程統一：

```text
開發者電腦
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

`cfm` **不會取代 `cloudflared`**，也不會重新實作 Cloudflare Tunnel protocol。

## 兩種操作模式

### 1. Tunnel Token 模式 — 最低權限

Cloudflare 上已經有 remotely-managed Tunnel 時：

```bash
cfm add company-a
cfm start company-a
```

不需要 Account API Token。v0.3 中，尚未綁定 Account 的 `token-only` profile 會放在 `legacy/tunnels/`，直到你明確執行 adoption。

### 2. Account API 模式 — 可選的資源管理

如果希望直接從 CLI 建立與管理 Cloudflare 資源：

```bash
cfm account add company-a
cfm tunnel create company-a project-dev
cfm route add company-a project-dev \
  --hostname api-dev.example.com \
  --url http://localhost:3001 \
  --dns
cfm start project-dev
```

Account API Token 與 Tunnel Token 會分開保存，並依所屬 Cloudflare Account 分資料夾管理。

## 功能重點

- **多 Account 隔離** — 每個 Cloudflare Account 都有自己的本機 credential boundary。
- **Account-based storage** — 使用 `accounts/<account>/api-token` 與 `accounts/<account>/tunnels/*.token`。
- **向後相容** — 既有 v0.1 / v0.2 profile alias 升級後仍可直接使用。
- **安全 schema v3 Migration** — v1/v2 metadata 先備份，secret relocation 可恢復且避免衝突覆蓋。
- **Migration 預覽** — `cfm migrate --dry-run` 可先看所有 credential 移動計畫。
- **CLI 自動更新** — v0.3+ 可使用 `cfm upgrade`。
- **未來安裝器擴充** — updater abstraction 現在支援 npm/GitHub 流程，也預留未來 Homebrew formula。
- **Explicit Adoption** — 把既有 Tunnel 綁定到 Account，不會重複建立 remote Tunnel；Token 會移進該 Account 目錄。
- **Tunnel Provisioning** — list/create/show/delete remotely-managed Tunnel。
- **Published Hostname 管理** — hostname → origin。
- **可選 DNS 自動化** — 只有明確要求且 Token 有權限時才建立/移除 CNAME。
- **自動 Zone 判斷** — `--dns` 沒有 Zone ID 時可由 hostname 找 Zone。
- **權限感知診斷** — 區分 Tunnel / Zone / DNS 權限並處理 Cloudflare code `10000`。
- **一條指令公開服務** — `cfm expose` 組合 Tunnel + route + DNS + connector startup。
- **Credential 保護** — 檔案權限 `0600`，不把 raw Tunnel Token 放進 process args。
- **零 runtime npm dependency** — Node.js 20+。

## 系統需求

- macOS 或 Linux
- Node.js 20+
- `cloudflared` 已安裝且存在於 `PATH`
- 依使用模式具備對應 Cloudflare 權限

macOS：

```bash
brew install cloudflared
```

## 安裝

從 `main` 安裝最新版：

```bash
npm install -g github:AdemKao/cloudflare-management
```

安裝 v0.3.0：

```bash
npm install -g github:AdemKao/cloudflare-management#v0.3.0
```

確認：

```bash
cfm --version
cfm --help
```

> Homebrew distribution 是規劃中的安裝方式。v0.3 有 Homebrew updater adapter，不代表 formula/tap 已經正式發布；在正式發布前仍請使用 npm/GitHub 安裝。

## 更新版本

### v0.2.x 使用者：第一次升級一次

`cfm upgrade` 從 v0.3 才存在，因此 v0.2.x 第一次先執行：

```bash
npm install -g github:AdemKao/cloudflare-management#v0.3.0
cfm --version
cfm migrate --dry-run
cfm migrate
```

### v0.3 之後

之後直接：

```bash
cfm upgrade
```

只看計畫：

```bash
cfm upgrade --dry-run
```

自動確認：

```bash
cfm upgrade --yes
```

刻意跟 `main`：

```bash
cfm upgrade --channel main
```

目前 npm/GitHub stable channel 會取得最新 GitHub Release tag，並安裝該確切版本。更新命令使用 argument array，不透過 shell 字串插值，成功後會再執行 `cfm migrate`。

重要環境更新前請看 [升級指南](./UPGRADING.zh-TW.md)。

## v0.3 Account-based 資料夾

```text
~/.config/cloudflare-management/
├── config.json
├── backups/
│   ├── config.v1.backup.json
│   └── config.v2.backup.json
├── accounts/
│   ├── company-a/
│   │   ├── api-token
│   │   └── tunnels/
│   │       ├── project-dev.token
│   │       └── webhook-dev.token
│   └── company-b/
│       ├── api-token
│       └── tunnels/
└── legacy/
    └── tunnels/
        └── unbound-profile.token
```

現在 filesystem 跟 domain model 一致：API-managed Tunnel credential 會放在真正擁有它的 Account 目錄；還沒綁 Account 的 token-only profile 才留在 `legacy/tunnels/`。

## 從 v0.1 / v0.2 安全 Migration

先預覽：

```bash
cfm migrate --dry-run
```

執行：

```bash
cfm migrate
```

Migration 會保留 Account/profile alias 與 credential 內容，只更新 credential file path。替換舊 metadata 前會在 `backups/` 建立 version-specific backup。

如果 Migration 中途被中斷，可以在下次執行繼續；如果 destination 已經存在**不同內容**的 credential，`cfm` 會直接停止，不會覆蓋。

原本的 profile alias 不變：

```bash
cfm start company-a
cfm status company-a
cfm logs company-a
```

## Quick Start：已經有 Tunnel

先從 Cloudflare Dashboard 取得 Tunnel Token：

```bash
cfm init
cfm add company-a
cfm start company-a
cfm status company-a
```

Token-only credential 會放在：

```text
legacy/tunnels/company-a.token
```

Dashboard 操作請看 [Tunnel Token 指南](./TUNNEL_TOKEN.zh-TW.md)。

## Quick Start：直接從 CLI 建立 Tunnel

加入 Account API credential：

```bash
cfm account add company-a
```

建立 Tunnel：

```bash
cfm tunnel create company-a project-dev
```

本機資料會是：

```text
accounts/company-a/
├── api-token
└── tunnels/
    └── project-dev.token
```

設定 route：

```bash
cfm route add company-a project-dev \
  --hostname api-dev.example.com \
  --url http://localhost:3001
```

如果要同時管理 DNS：

```bash
cfm route add company-a project-dev \
  --hostname api-dev.example.com \
  --url http://localhost:3001 \
  --dns
```

Zone 判斷順序：

```text
1. --zone-id <ZONE_ID>
2. Account defaultZoneId
3. 從 hostname 自動 discovery
```

自動 discovery 需要 Zone Read；DNS record mutation 另外需要目標 Zone 的 DNS Edit。

### 修改 DNS 前先檢查權限

```bash
cfm account doctor company-a
```

基本 doctor 只驗證 Tunnel API。要另外驗證 Zone discovery 與 DNS read：

```bash
cfm account doctor company-a \
  --hostname api-dev.example.com
```

Doctor 不會修改 DNS，所以成功不代表 DNS Write 一定有權限。

## Adopt 既有 token-only Tunnel

如果之前已經：

```bash
cfm add company-a
```

之後希望把同一條 remote Tunnel 綁定到 Account：

```bash
cfm account add company-a
cfm tunnel adopt company-a company-a \
  --tunnel-id <TUNNEL_UUID>
```

Adoption 不會建立第二條 Tunnel，也不會改變 Token value；只會把 credential 從：

```text
legacy/tunnels/company-a.token
```

移到：

```text
accounts/company-a/tunnels/company-a.token
```

## 一條指令公開服務：`cfm expose`

```bash
cfm expose company-a \
  --name project-dev \
  --hostname api-dev.example.com \
  --port 3001
```

流程：

```text
驗證 Account credential
       ↓
重用 adopted/provisioned Tunnel
或在沒有 local profile 時建立 Tunnel
       ↓
設定 hostname → origin
       ↓
判斷 Zone ID
       ↓
除非 --no-dns，否則管理 DNS
       ↓
除非 --no-start，否則啟動 cloudflared
       ↓
輸出 public URL/status
```

`cfm expose` 不會偷偷 adopt token-only profile。

## 指令總覽

| 區域 | 指令 |
| --- | --- |
| Lifecycle | `migrate`, `upgrade` |
| Local profiles | `init`, `add`, `remove`, `list` |
| Connector process | `start`, `stop`, `restart`, `start-all`, `stop-all`, `status`, `logs`, `doctor` |
| Accounts | `account add/list/show/doctor/remove` |
| Tunnels | `tunnel list/create/adopt/show/token/delete` |
| Routes | `route list/add/remove` |
| Orchestration | `expose` |

完整參數請看 [Command Reference](./COMMANDS.md)。

## Security Model

主要原則：

- Account API Token 與 Tunnel Token 是不同 credential。
- API-managed credential 依 Account boundary 分資料夾。
- 未綁 Account 的 token-only profile 留在 `legacy/tunnels/`。
- Credential file 權限為 `0600`。
- Raw credential 不寫進 `config.json`，正常命令不輸出 raw Token。
- Migration 不會覆蓋內容不同的 destination credential。
- Remote Tunnel delete 需要確認或 `--yes`。
- `cfm upgrade` 不使用 shell interpolation，也不會猜測未知/dev installation。
- 不同客戶應使用特定 Account / Zone 的最小權限 Token。

完整說明請看 [Security](./SECURITY.md)。

## 文件

- [文件索引](./README.md)
- [English guide](./README.en.md)
- **繁體中文**
- [日本語](./README.ja.md)
- [升級指南](./UPGRADING.zh-TW.md)
- [Tunnel Token 指南](./TUNNEL_TOKEN.zh-TW.md)
- [Architecture](./ARCHITECTURE.md)
- [Command Reference](./COMMANDS.md)
- [Configuration](./CONFIGURATION.md)
- [Security](./SECURITY.md)
- [Troubleshooting](./TROUBLESHOOTING.md)
- [Roadmap](./ROADMAP.md)
- [Changelog](../CHANGELOG.md)

## 開發

```bash
git clone https://github.com/AdemKao/cloudflare-management.git
cd cloudflare-management
npm link
npm run check
```

測試涵蓋 config migration/recovery/conflict、Account-based storage、adoption token relocation、Cloudflare API error/DNS authorization、installer detection 與 updater command construction。

## 專案範圍

`cfm` 是聚焦於 Cloudflare Tunnel workflow 的 CLI，不是通用 Cloudflare administration CLI。Cloudflare 仍是 Account、Zone、Tunnel、remote configuration、DNS、Access policy 與 credential lifecycle 的 source of truth。

## License

[MIT](../LICENSE) © 2026 Adem Kao
