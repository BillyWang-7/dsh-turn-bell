# 发布清单 / Publishing checklist

目标发布面（按用户要求）：awesome-dsh-plugin 插件目录（dshmarket / DSH 内「插件市场」的数据源）、npm、以及 GitHub 仓库本体。

> 现状：本机没有任何 GitHub / npm 凭证（无 `gh`、无 SSH key、无 npm token、无 keychain 条目），
> 所以推送、建仓库、开 PR、`npm publish` 都还没有执行。凭证到手后按下面顺序跑即可。

## 0. 需要的东西

- GitHub 账号（假设为 `BillyWang-7`；不是的话把本文件与 `registry-entry.yml` 里的 `owner` 全改掉）。
- GitHub token：classic PAT，勾 `repo`（建仓库、push、开 PR 都要）。
- npm token：Automation 类型（`npm publish` 用，绕过 2FA 交互）。

## 1. 建 GitHub 仓库

```sh
curl -sf -X POST https://api.github.com/user/repos \
  -H "Authorization: Bearer $GITHUB_TOKEN" \
  -H "Accept: application/vnd.github+json" \
  -d '{
    "name": "dsh-turn-bell",
    "description": "Native DeepSeek Harness notifications in the app own icon and sound: a turn finished, or the agent waits on you. Click the banner to open that conversation.",
    "homepage": "https://github.com/awesome-dsh-plugin/awesome-dsh-plugin",
    "topics": ["dsh-plugin", "deepseek-harness", "dsh", "notifications", "macos"],
    "private": false
  }'
```

仓库描述不要营销词；topic 必须有 `dsh-plugin`（目录 CI 检查）。

## 2. 推送

```sh
git remote add origin https://github.com/BillyWang-7/dsh-turn-bell.git
git push -u origin main
```

## 3. 发 npm（推荐，`dsh plugin add` 不用本地构建）

```sh
npm config set //registry.npmjs.org/:_authToken "$NPM_TOKEN" --location=project
npm publish --access public
```

包名 `dsh-turn-bell` 目前 npm 上返回 404，可用。包内已带 `dsh.bundle.patch` 与预构建 JS，安装时不需要 allowBuilds。

## 4. （可选）GitHub Release 预构建 tarball

```sh
npm pack                                  # dsh-turn-bell-1.3.0.tgz
cp dsh-turn-bell-1.3.0.tgz dsh-turn-bell.tgz   # release 资源名不带版本号
gh release create v1.3.0 dsh-turn-bell.tgz --title "Turn Bell 1.3.0" --notes-file CHANGELOG.md
```

然后取消 `registry-entry.yml` 里 `tarball:` 那行的注释。`latest/download/` 下的文件名必须不带版本号，否则下次发版即 404。

## 5. 提 PR 到插件目录

一个 PR 只加一个文件：`data/plugins/BillyWang-7__dsh-turn-bell.yml`，内容复制 `registry-entry.yml`。

```sh
# 5.1 fork
curl -sf -X POST https://api.github.com/repos/awesome-dsh-plugin/awesome-dsh-plugin/forks \
  -H "Authorization: Bearer $GITHUB_TOKEN"

# 5.2 在 fork 上写文件（base64）
B64=$(base64 -i publish/registry-entry.yml | tr -d '\n')
curl -sf -X PUT "https://api.github.com/repos/BillyWang-7/awesome-dsh-plugin/contents/data/plugins/BillyWang-7__dsh-turn-bell.yml" \
  -H "Authorization: Bearer $GITHUB_TOKEN" \
  -H "Accept: application/vnd.github+json" \
  -d "{\"message\":\"Add BillyWang-7/dsh-turn-bell\",\"content\":\"$B64\",\"branch\":\"add-dsh-turn-bell\"}"

# 5.3 开 PR（注意不是提到 dsh-market 仓库）
curl -sf -X POST https://api.github.com/repos/awesome-dsh-plugin/awesome-dsh-plugin/pulls \
  -H "Authorization: Bearer $GITHUB_TOKEN" \
  -H "Accept: application/vnd.github+json" \
  -d '{
    "title": "Add BillyWang-7/dsh-turn-bell",
    "head": "BillyWang-7:add-dsh-turn-bell",
    "base": "main",
    "body": "Turn Bell (收工铃): native DSH notifications in the app icon and sound for turn completion and pending confirmations, with click-through to the exact conversation. Repo declares dsh.bundle + cordis.patch.yml and is installable via `dsh plugin add dsh-turn-bell`."
  }'
```

CI 还要求仓库创建满 1 天，所以建仓库当天 PR 可能先失败，隔天重跑即可。

## 6. 其它可下载的地方

- `dshget.com`（DSH Get）：镜像 `awesome-dsh-plugin.com/plugins.json`，目录收录后自动出现，无需单独提交。
- npm 镜像站（npmmirror 等）会随 `npm publish` 自动同步。
