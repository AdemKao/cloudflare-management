# `cfm` のアップグレード

[English](./UPGRADING.en.md) · [繁體中文](./UPGRADING.zh-TW.md) · **日本語**

## 現在のバージョンを確認

```bash
cfm --version
```

## v0.2.x から v0.3.0 へ最初に更新する場合

`cfm upgrade` は v0.3 で追加されるため、v0.2.x から最初の 1 回だけは既存の GitHub/npm インストール方法を使います：

```bash
npm install -g github:AdemKao/cloudflare-management#v0.3.0
cfm --version
```

ローカル storage migration を先に確認：

```bash
cfm migrate --dry-run
```

必要なら明示的に実行：

```bash
cfm migrate
```

手動で実行しなくても、古い config を読む `cfm` コマンドは migration を自動実行します。

## v0.3 以降の更新

以後は：

```bash
cfm upgrade
```

デフォルトでは：

1. install manager を検出；
2. 現在の GitHub/npm distribution では最新の安定 GitHub Release を解決；
3. ローカル migration の必要性を preview；
4. confirmation；
5. package update；
6. 新しくインストールされた CLI で `cfm migrate` を実行。

確認を省略：

```bash
cfm upgrade --yes
```

preview のみ：

```bash
cfm upgrade --dry-run
```

開発中の `main` を使う場合：

```bash
cfm upgrade --channel main
```

`main` は tagged stable release と同じではありません。

## Install manager と将来の Homebrew 対応

v0.3 では updater を installer abstraction として分離しています。

現在実際に利用できる distribution：

```text
npm executable + GitHub repository / release tags
```

将来 Homebrew formula/tap を公開した後も同じ `cfm upgrade` UX を使えるよう、Homebrew adapter も用意しています。ただし **adapter があることと、Homebrew formula が公開済みであることは別です**。formula/tap が正式に用意されるまでは Homebrew を現在の install method として扱わないでください。

必要な場合のみ manager を明示できます：

```bash
cfm upgrade --manager npm
cfm upgrade --manager brew
```

## v0.3 の Account 単位 storage

v0.3 で変わるのは **credential file の path** です。profile alias と Token の値は変わりません。

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

API 管理対象 credential は所有する Cloudflare Account directory の下に配置されます。まだ Account に紐づいていない `token-only` profile は `legacy/tunnels/` に残ります。

## v1 / v2 → v3 Migration

Migration は：

1. Account/profile alias を維持；
2. Account API Token / Tunnel Token の値を維持；
3. 古い metadata を置き換える前に backup を作成；
4. Account API Token を `accounts/<account>/api-token` へ移動；
5. `adopted` / `provisioned` Tunnel Token を `accounts/<account>/tunnels/` へ移動；
6. 未紐付け `token-only` profile を `legacy/tunnels/` へ移動；
7. schema v3 を atomic write；
8. destination に異なる内容の credential がある場合は上書きせず停止します。

途中で process が終了しても recovery できる設計です。secret が移動済みで config が v1/v2 のままでも、次回は source missing + destination existing を認識して migration を続行します。

## 以前から `cfm add` を使っている場合

以前：

```bash
cfm add company-a
cfm start company-a
```

を使っていても、v0.3 でそのまま：

```bash
cfm start company-a
cfm status company-a
cfm logs company-a
```

を利用できます。`company-a` という profile alias と Tunnel Token の値は維持され、Token file の location だけが v0.3 layout へ移動します。

## Migration 後に Account へ Adopt

既存の同じ remote Tunnel を API 管理へ移す場合：

```bash
cfm account add company-a
cfm tunnel adopt company-a company-a --tunnel-id <TUNNEL_UUID>
```

Token value は維持しつつ：

```text
legacy/tunnels/company-a.token
```

から：

```text
accounts/company-a/tunnels/company-a.token
```

へ移動します。Adoption は別の remote Tunnel を作成しません。

## 手動 install / update も引き続き利用可能

最新 `main`：

```bash
npm install -g github:AdemKao/cloudflare-management
```

v0.3.0 に固定：

```bash
npm install -g github:AdemKao/cloudflare-management#v0.3.0
```

config/credentials は npm package directory の外にあるため、package の再インストールで削除されません。

## 重要な開発マシンでの推奨手順

更新前：

```bash
cfm --version
cfm status
cfm doctor
cfm migrate --dry-run
```

更新後：

```bash
cfm upgrade
cfm --version
cfm doctor
```

## Rollback の注意

古い tag を再インストールすること自体はできますが、schema v3 が書き込まれた後は v2 layout しか理解しない古い CLI が新しい config/path を正しく扱えない可能性があります。

通常は forward fix を優先してください。metadata backup は：

```text
~/.config/cloudflare-management/backups/
```

に保存されます。credential の現在位置を確認せずに古い `config.json` だけを戻さないでください。

## Troubleshooting

```bash
cfm migrate --dry-run
cfm upgrade --dry-run
```

その後 [Troubleshooting](./TROUBLESHOOTING.md) を参照してください。
