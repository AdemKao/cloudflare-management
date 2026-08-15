# cloudflare-management

[English](./README.en.md) · **繁體中文** · [日本語](./README.ja.md) · [回到主 README](../README.md)

`cloudflare-management` 是一個小型本機 CLI，用來在同一台開發機上管理多個、分屬不同公司或客戶 Cloudflare Account 的 **remotely-managed Cloudflare Tunnel connector**。

可執行指令為 `cfm`，也可以使用 `cloudflare-management` 作為別名。

## 為什麼需要它

這個工具主要解決自由接案、多公司、多客戶的開發情境：同一台 Mac 可能同時需要連接多個互相獨立的 Cloudflare Account，但又不希望一直執行 `cloudflared tunnel login`、切換 account credential，或把不同客戶的憑證混在一起。

每個客戶仍然在自己的 Cloudflare Account 中持有自己的 remotely-managed Tunnel；`cfm` 只負責在本機安全保存該 Tunnel 的 connector token，以及啟動、停止與監控對應的 `cloudflared` process。

## 系統需求

- macOS 或 Linux
- Node.js 20+
- 已安裝 `cloudflared`，且可從 `PATH` 執行
- 每個客戶的 Cloudflare Dashboard 中都已建立 remotely-managed Cloudflare Tunnel

macOS + Homebrew：

```bash
brew install cloudflared
```

## 安裝

### 直接從 GitHub 安裝

功能合併到 `main` 後：

```bash
npm install -g github:AdemKao/cloudflare-management
```

確認安裝：

```bash
cfm --version
cfm --help
```

### PR 合併前安裝 feature branch

```bash
npm install -g github:AdemKao/cloudflare-management#feat/local-cli
```

### 本機開發

```bash
git clone https://github.com/AdemKao/cloudflare-management.git
cd cloudflare-management
npm link
```

此時 `cfm` 會成為全域可用指令，但實際執行的是你本機 checkout 的程式碼。

解除連結：

```bash
npm unlink -g cloudflare-management
```

## Cloudflare 設定方式

針對每一間公司或客戶：

1. 進入該客戶的 Cloudflare Account。
2. 在 Dashboard 建立 **remotely-managed Cloudflare Tunnel**。
3. 在 Cloudflare 設定 Published Application hostname 與對應 localhost service。
4. 開啟 Tunnel，從 **Add a replica** 的安裝指令取得 connector token。
5. 使用 `cfm add` 將 token 安全加入本機。

例如：

```text
Company A Cloudflare Account
└── company-a-dev tunnel
    ├── api-dev.company-a.com     -> http://localhost:3001
    └── hook-dev.company-a.com    -> http://localhost:3002

Company B Cloudflare Account
└── company-b-dev tunnel
    └── api-dev.company-b.com     -> http://localhost:4001

Company C Cloudflare Account
└── company-c-dev tunnel
    ├── app-dev.company-c.com     -> http://localhost:5001
    └── webhook-dev.company-c.com -> http://localhost:5002
```

Cloudflare Account 與 Domain 彼此仍完全隔離；`cfm` 只管理本機 connector process。

## 第一次使用

初始化本機資料夾：

```bash
cfm init
```

新增公司或客戶：

```bash
cfm add claire
```

CLI 會要求輸入 Tunnel token，輸入過程不會回顯在 terminal。

也可以從既有 token file 匯入：

```bash
cfm add client-b --token-file ~/Downloads/client-b.token
```

Token 會複製到：

```text
~/.config/cloudflare-management/secrets/<name>.token
```

Token file 權限設為 `600`。

## 常用指令

```bash
# 新增 / 移除 local tunnel profile
cfm add claire
cfm remove claire

# 查看設定與 process 狀態
cfm list
cfm status
cfm status claire

# 啟動 / 停止單一公司 tunnel
cfm start claire
cfm stop claire
cfm restart claire

# 啟動 / 停止全部 tunnel
cfm start-all
cfm stop-all

# 查看 log
cfm logs claire
cfm logs claire --follow

# 環境診斷
cfm doctor
cfm doctor claire

# 顯示 config 位置
cfm config
```

範例：

```text
$ cfm status
NAME       STATUS   PID
claire     running  91231
client-b   stopped  -
client-c   running  91402
```

## 本機檔案位置

設定檔：

```text
~/.config/cloudflare-management/config.json
```

Tunnel tokens：

```text
~/.config/cloudflare-management/secrets/
```

Runtime state 與 logs：

```text
~/.local/state/cloudflare-management/
├── logs/
└── runtime/
```

如果有設定 `XDG_CONFIG_HOME` / `XDG_STATE_HOME`，CLI 會遵循 XDG 路徑。

## 安全模型

- Tunnel token **永遠不會存進 Git repository**。
- Token 使用本機檔案保存，權限為 `600`。
- `cfm start` 使用 `cloudflared tunnel run --token-file ...`，避免把 token 直接暴露在 process command line。
- 不同客戶 / security boundary 建議使用不同 remotely-managed Tunnel。
- Cloudflare Tunnel token 屬於敏感憑證，離場或權限變更時應在 Cloudflare 立即 rotate / revoke。

## v0.1 範圍

第一版刻意不要求高權限 Cloudflare API token，也不會自動建立 DNS 或 route。

Cloudflare Dashboard 負責：

- Tunnel 建立
- Published Application routes
- DNS / Domain 設定
- Token rotate / revoke

`cfm` 負責：

- 本機 token 保存
- 啟動 / 停止 `cloudflared` connectors
- Status
- Logs
- Diagnostics

未來如果 Dashboard 手動設定 route 變成維運瓶頸，再考慮加入 Cloudflare API integration。

## 開發

```bash
npm run check
```

這會執行 syntax check 與 Node test suite。

## 延伸文件

- [Architecture](./ARCHITECTURE.md)
- [Security](./SECURITY.md)
