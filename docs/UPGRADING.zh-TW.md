# 更新 `cfm`

[English](./UPGRADING.en.md) · **繁體中文** · [日本語](./UPGRADING.ja.md)

## 先確認目前版本

```bash
cfm --version
```

## v0.2.x 使用者第一次升級到 v0.3.0

`cfm upgrade` 是從 v0.3 才新增的，所以 v0.2.x 還不能直接執行這個指令。第一次請先沿用目前 GitHub/npm 安裝方式：

```bash
npm install -g github:AdemKao/cloudflare-management#v0.3.0
cfm --version
```

接著先預覽本機資料 Migration：

```bash
cfm migrate --dry-run
```

如果內容正確，可以明確執行：

```bash
cfm migrate
```

即使沒有手動執行，之後任何需要讀取舊 config 的 `cfm` 指令也會自動進行 Migration。

## v0.3 之後怎麼更新

之後可以直接使用：

```bash
cfm upgrade
```

預設流程會：

1. 判斷目前安裝方式；
2. 對目前 GitHub/npm distribution 取得最新穩定 GitHub Release；
3. 預覽是否需要本機資料 Migration；
4. 要求確認；
5. 更新 CLI package；
6. 使用更新後的 `cfm` 再執行 `cfm migrate`。

自動確認：

```bash
cfm upgrade --yes
```

只看計畫、不做任何異動：

```bash
cfm upgrade --dry-run
```

如果刻意要跟 `main`：

```bash
cfm upgrade --channel main
```

`main` 是開發中的最新程式碼，不等於正式 release tag。

## 安裝方式與未來 Homebrew

v0.3 開始把更新流程抽成 installer abstraction。

目前正式使用的是：

```text
npm executable + GitHub repository / release tags
```

程式也先準備了 Homebrew adapter，讓未來有正式 formula/tap 後，可以沿用同一個：

```bash
cfm upgrade
```

但**目前有 adapter 不代表 Homebrew formula 已經正式發布**。在 formula/tap 真正完成前，不要因為看到 `--manager brew` 就認為已經可以透過 Homebrew 安裝。

如果自動判斷錯誤，可以明確指定：

```bash
cfm upgrade --manager npm
cfm upgrade --manager brew
```

只有在你確定原本是怎麼安裝時才建議 override。

## v0.3 新的 Account 資料夾結構

v0.3 會改變的是**credential 的本機路徑**，不是 credential 內容，也不是 profile alias。

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
│   │       └── project-dev.token
│   └── company-b/
│       ├── api-token
│       └── tunnels/
└── legacy/
    └── tunnels/
        └── unbound-profile.token
```

這樣 filesystem 就跟 domain/security boundary 一致：每個 Cloudflare Account 都有自己的資料夾；只有還沒綁定 Account 的 `token-only` profile 會留在 `legacy/tunnels/`。

## v1 / v2 → v3 Migration 規則

Migration 會：

1. 保留 Account alias 與 profile alias；
2. 保留 Account API Token / Tunnel Token 的內容；
3. 在替換舊 metadata 前先建立備份；
4. 把 Account API Token 移到 `accounts/<account>/api-token`；
5. 把 `adopted` / `provisioned` Tunnel Token 移到 `accounts/<account>/tunnels/`；
6. 把尚未綁 Account 的 `token-only` profile 移到 `legacy/tunnels/`；
7. 以 atomic write 寫入 schema v3；
8. 如果 destination 已經有不同內容的 secret，直接停止，不會猜哪一份才是正確的。

Migration 也考慮到中途中斷。如果 secret 已經移動，但 config 還停留在 v1/v2，下一次執行會辨識「source 不在、destination 已存在」並繼續完成，而不是建立第二份 credential。

## 原本已經使用 `cfm add` 的人

假設你以前已經：

```bash
cfm add company-a
cfm start company-a
```

升級 v0.3 之後仍然直接使用：

```bash
cfm start company-a
cfm status company-a
cfm logs company-a
```

`company-a` 這個 profile alias 不會改，Tunnel Token 的值也不會改；只有 token file 會移到新的 v0.3 storage layout。

## 升級後再 Adopt 到 Account

如果之後想讓同一條既有 Tunnel 進入 API 管理：

```bash
cfm account add company-a
cfm tunnel adopt company-a company-a --tunnel-id <TUNNEL_UUID>
```

Token value 會保留，但檔案會從：

```text
legacy/tunnels/company-a.token
```

移到：

```text
accounts/company-a/tunnels/company-a.token
```

Adoption 不會建立第二條 remote Tunnel。

## 手動安裝 / 更新仍然支援

從 `main` 安裝：

```bash
npm install -g github:AdemKao/cloudflare-management
```

鎖定 v0.3.0：

```bash
npm install -g github:AdemKao/cloudflare-management#v0.3.0
```

本機 config / credentials 都不在 npm package 目錄裡，所以重新安裝 package 不會刪除這些資料。

## 重要開發機建議升級流程

先檢查：

```bash
cfm --version
cfm status
cfm doctor
cfm migrate --dry-run
```

再更新並驗證：

```bash
cfm upgrade
cfm --version
cfm doctor
```

## Rollback 注意事項

你仍然可以重新安裝舊 tag，但 schema v3 寫入之後，只認得 v2 storage layout 的舊 CLI 不一定能正確讀取新的 config/path。

通常應優先做 forward fix。Migration metadata backup 會放在：

```text
~/.config/cloudflare-management/backups/
```

不要只還原舊 `config.json`，卻沒有一起確認 credential 現在實際位在哪裡。

## 更新問題排查

```bash
cfm migrate --dry-run
cfm upgrade --dry-run
```

再參考 [Troubleshooting](./TROUBLESHOOTING.md)。
