# 更新 `cfm`

[English](./UPGRADING.en.md) · **繁體中文** · [日本語](./UPGRADING.ja.md)

這份文件說明如何更新 `cloudflare-management`，以及更新時既有本機設定會發生什麼事。

## 先確認目前版本

```bash
cfm --version
```

## 更新到最新 `main`

如果原本是直接從 GitHub 安裝，更新時重新安裝即可：

```bash
npm install -g github:AdemKao/cloudflare-management
cfm --version
```

這會更新全域安裝的 CLI package，但不會刪除本機 `cfm` 資料。

## 安裝或鎖定指定 Release

```bash
npm install -g github:AdemKao/cloudflare-management#v0.2.2
cfm --version
```

如果希望不同開發機使用完全相同版本，建議使用 release tag。

## v0.2.2 權限診斷

v0.2.2 改善 Cloudflare Zone / DNS authorization handling。Cloudflare 有可能回傳 HTTP 200，但 response 是 `success: false` 並帶 error code `10000`（`Authentication error`）；`cfm` 現在會正確辨識成 authentication/authorization failure，並指出失敗是在 Zone discovery 還是 DNS record 操作。

基本檢查：

```bash
cfm account doctor company-a
```

現在只表示 Tunnel API access 正常，不會再暗示 Zone / DNS 權限也已驗證。

如果要額外確認 hostname 的 Zone discovery 與 DNS read：

```bash
cfm account doctor company-a \
  --hostname api-dev.example.com
```

Doctor 不會修改 DNS，所以成功不代表 DNS write 一定可用；`cfm route ... --dns` 仍需要目標 Zone 的 DNS Edit 權限。

## v0.2.1 DNS 行為

需要管理 DNS 時，Zone ID 會依序使用：

```text
1. --zone-id <ZONE_ID>
2. Account 的 defaultZoneId
3. 由 hostname 自動尋找對應 Zone
```

自動尋找需要目標 Zone 的 Zone Read。DNS record 建立/更新則是獨立的 DNS Edit 權限。如果不想提供 Zone Read，可以明確傳入 `--zone-id <ZONE_ID>`，但 DNS Edit 仍然需要。

## 本機資料放在哪裡

預設位置：

```text
~/.config/cloudflare-management/
~/.local/state/cloudflare-management/
```

這些目錄不在 npm 全域 package 目錄裡，因此更新或重新安裝 CLI 不會刪除：

- local profiles
- Account API Tokens
- Tunnel Tokens
- runtime state
- logs

## v0.1 → v0.2 Migration

如果你以前已經使用：

```bash
cfm add company-a
cfm start company-a
```

第一次由 v0.2 讀取設定時會：

1. 讀取既有 v1 metadata；
2. 在 migration 寫入前建立 `config.v1.backup.json`；
3. 把既有 profile 遷移為 `managementMode: token-only`；
4. 保留原本 profile alias；
5. 保留原本 Tunnel Token file 路徑與內容；
6. 使用 atomic write 寫入 schema v2。

你**不需要重新輸入 Tunnel Token**，也不需要加入 Account API Token 才能繼續使用舊 profile。

更新後可以直接：

```bash
cfm status company-a
cfm start company-a
cfm logs company-a
```

## 更新後可選擇把既有 Tunnel 納入 API 管理

如果之後希望同一條既有 remote Tunnel 可以由 `cfm` 透過 API 管理：

```bash
cfm account add company-a
cfm tunnel adopt company-a company-a --tunnel-id <TUNNEL_UUID>
```

Adoption 不會建立新的 Tunnel，也不會預設替換原本的 Tunnel Token。

## 升級前建議檢查

重要開發機建議先執行：

```bash
cfm --version
cfm status
cfm doctor
```

你也可以自行備份：

```text
~/.config/cloudflare-management/config.json
```

請不要把 secret file 複製到公開 Git repository、Issue、PR 或公開聊天內容。

## Rollback

要重新安裝目前 patch release：

```bash
npm install -g github:AdemKao/cloudflare-management#v0.2.2
```

但要注意：一旦 schema v2 已經寫入，舊版只認得 schema v1 的 CLI 不一定能正確讀取。通常應優先升級到修正版；只有在你理解影響時，才考慮還原 migration 前的 metadata backup。

## 更新後排查問題

```bash
cfm --version
cfm doctor
cfm status
```

API / DNS mode 可以再跑：

```bash
cfm account doctor company-a --hostname api-dev.example.com
```

再參考 [Troubleshooting](./TROUBLESHOOTING.md)。
