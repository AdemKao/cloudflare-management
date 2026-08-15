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

> 此繁體中文版與 root `README.md` 使用相同資訊架構；新增功能、安裝、升級、安全與 Quick Start 應同步維護。

## 為什麼需要這個工具

同時維護多間公司時，通常也會同時面對多個 Cloudflare Account、Domain、Tunnel Token、API Token、localhost port，以及多個 `cloudflared` process。

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

如果 Cloudflare 上已經有 remotely-managed Tunnel，只需要把該 Tunnel 的 Token 保存到本機：

```bash
cfm add company-a
cfm start company-a
```

不需要 Account API Token。

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

Account API Token 與 Tunnel Token 會分開保存。

## 功能重點

- **多 Account 隔離** — 不同公司可以使用彼此獨立的 Account/API/Tunnel credential。
- **向後相容** — 已經使用 `cfm add <profile>` 的 v0.1 使用者升級後仍可直接繼續使用。
- **安全 Migration** — v1 metadata 會先備份，再原子化、可重複地升級成 schema v2。
- **Explicit Adoption** — 可以把既有 Tunnel 納入 API 管理，不會因此重複建立另一條 Tunnel。
- **Tunnel Provisioning** — 支援 list/create/show/delete remotely-managed Tunnel。
- **Published Hostname 管理** — 設定 hostname → origin 規則。
- **可選 DNS 自動化** — 只有在明確要求且 API Token 有權限時才建立/移除 CNAME。
- **一條指令公開服務** — `cfm expose` 可組合 Tunnel + route + DNS + connector startup。
- **Secret 保護** — Token 保存於 repo 外，檔案權限為 `0600`。
- **Process args 不放 raw Tunnel Token** — 使用 `cloudflared tunnel run --token-file ...`。
- **診斷與 Log** — 內建 `doctor`、`status` 與 log follow。
- **零 runtime npm dependency** — 僅需要 Node.js 20+。

## 系統需求

- macOS 或 Linux
- Node.js 20+
- `cloudflared` 已安裝且存在於 `PATH`
- 依使用模式具備對應的 Cloudflare Account 權限

macOS：

```bash
brew install cloudflared
```

## 安裝

從 `main` 安裝最新版：

```bash
npm install -g github:AdemKao/cloudflare-management
```

安裝指定 release tag：

```bash
npm install -g github:AdemKao/cloudflare-management#v0.2.0
```

確認安裝：

```bash
cfm --version
cfm --help
```

## 更新版本

如果原本就是直接從 GitHub 安裝 `cfm`，更新時重新安裝 `main` 即可：

```bash
npm install -g github:AdemKao/cloudflare-management
cfm --version
```

如果要鎖定指定 release：

```bash
npm install -g github:AdemKao/cloudflare-management#v0.2.0
cfm --version
```

Profile、Account API Token、Tunnel Token、runtime state 與 logs 都保存在 npm package 目錄之外，因此重新安裝/更新 CLI **不會刪除既有設定**。

從 v0.1 升級到 v0.2 時，第一次讀取設定會先備份 v1 metadata，然後自動把既有 profile 遷移成 `token-only`，並保留原本的 Tunnel Token 路徑。

重要開發機或客戶環境升級前，請先閱讀 [升級指南](./UPGRADING.zh-TW.md)。

## Quick Start：已經有 Tunnel

先從 Cloudflare Dashboard 取得 Tunnel Token：

```bash
cfm init
cfm add company-a
cfm start company-a
cfm status company-a
```

Cloudflare Dashboard 的完整操作路徑請看 [Tunnel Token 指南](./TUNNEL_TOKEN.zh-TW.md)。

## Quick Start：直接從 CLI 建立 Tunnel

先加入一組最小權限的 Cloudflare Account API credential：

```bash
cfm account add company-a
```

也可以用非互動模式：

```bash
cfm account add company-a \
  --account-id <ACCOUNT_ID> \
  --token-file ~/.secrets/company-a-api-token \
  --zone-id <OPTIONAL_DEFAULT_ZONE_ID>
```

建立 Tunnel：

```bash
cfm tunnel create company-a project-dev
```

設定 published hostname：

```bash
cfm route add company-a project-dev \
  --hostname api-dev.example.com \
  --url http://localhost:3001
```

如果 API Token 同時具備該 Zone 的 DNS 權限，可以加上 `--dns`：

```bash
cfm route add company-a project-dev \
  --hostname api-dev.example.com \
  --url http://localhost:3001 \
  --dns
```

最後啟動 connector：

```bash
cfm start project-dev
```

## 一條指令公開服務：`cfm expose`

Account 已設定 default Zone ID 時，可以直接：

```bash
cfm expose company-a \
  --name project-dev \
  --hostname api-dev.example.com \
  --port 3001
```

流程如下：

```text
驗證 Account credential
       ↓
重用 adopted / provisioned Tunnel
如果沒有 local profile 才建立新的 Tunnel
       ↓
設定 hostname → origin
       ↓
除非 --no-dns，否則管理 DNS
       ↓
除非 --no-start，否則啟動 cloudflared
       ↓
輸出 public URL / status
```

`cfm expose` 不會偷偷把 `token-only` profile adopt 進 API 管理；需要先明確執行 `cfm tunnel adopt`。

## 已經使用過 v0.1 的使用者

假設你之前已經執行：

```bash
cfm add company-a
```

升級後可以直接繼續：

```bash
cfm start company-a
cfm status company-a
cfm logs company-a
```

Profile 會遷移成：

```text
managementMode: token-only
account: null
tunnelId: null
原本 tokenFile 路徑保留
```

如果未來希望把同一條既有 Tunnel 納入 API 管理：

```bash
cfm account add company-a
cfm tunnel adopt company-a company-a
```

如果名稱無法唯一判斷，請明確指定 remote Tunnel：

```bash
cfm tunnel adopt company-a company-a \
  --tunnel-id <TUNNEL_UUID>
```

Adoption 不會建立第二條 Tunnel，也不會預設覆蓋原本的 Tunnel Token。

## 指令總覽

| 區域 | 指令 |
| --- | --- |
| Local profiles | `init`, `add`, `remove`, `list` |
| Connector process | `start`, `stop`, `restart`, `start-all`, `stop-all`, `status`, `logs`, `doctor` |
| Accounts | `account add/list/show/doctor/remove` |
| Tunnels | `tunnel list/create/adopt/show/token/delete` |
| Routes | `route list/add/remove` |
| Orchestration | `expose` |

完整參數請看 [Command Reference](./COMMANDS.md)。

## Security Model

不同用途的 Secret 會分開保存：

```text
~/.config/cloudflare-management/
├── config.json
└── secrets/
    ├── company-a.token                 # 舊版 / token-only 路徑可保留
    ├── accounts/
    │   └── company-a.api-token
    └── tunnels/
        └── project-dev.token
```

Runtime data：

```text
~/.local/state/cloudflare-management/
├── logs/
└── runtime/
```

主要原則：

- API Token 與 Tunnel Token 是兩種不同 credential。
- Secret file 權限為 `0600`。
- Raw credential 不會寫進 `config.json`。
- 正常指令不會輸出 raw token。
- Remote Tunnel delete 需要確認或 `--yes`。
- 不同客戶應使用限制到特定 Account / Zone 的最小權限 Token，不要共用跨客戶的高權限 credential。

完整說明請看 [Security](./SECURITY.md)。

## 文件

- [文件索引](./README.md)
- [English guide](./README.en.md)
- **繁體中文**
- [日本語](./README.ja.md)
- [升級指南](./UPGRADING.zh-TW.md)
- [Tunnel Token 指南](./TUNNEL_TOKEN.zh-TW.md)
- [Architecture](./ARCHITECTURE.md)
- [v0.2 API Design](./V0.2_API_MANAGEMENT.md)
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

測試包含 migration、向後相容、Cloudflare API error path、secret leakage、alias coexistence、duplicate prevention 與 adoption 等情境，Cloudflare API 測試使用 mocked response。

## 專案範圍

`cfm` 的目標是成為聚焦於 Cloudflare Tunnel 工作流程的 CLI，而不是完整的 Cloudflare Account 管理工具。

Cloudflare 仍然是 Account、Zone、Tunnel、remote configuration、DNS、Access policy 與 credential 發行/撤銷的 source of truth。

## License

[MIT](../LICENSE) © 2026 Adem Kao
