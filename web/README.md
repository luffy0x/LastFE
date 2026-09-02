# Knowledge Frontier

Knowledge Frontier 是一个面向求职知识分享的 Next.js 应用。首页提供可拖拽、缩放和键盘操作的 SVG 战略地图，领地页面从 SQLite 读取已发布内容，匿名投稿通过 GitHub Issues 进入审核流程。

## 本地运行

需要 Node.js 22 或更高版本，以及仓库声明的 pnpm 版本。

```powershell
pnpm install --frozen-lockfile
Copy-Item .env.example .env.local
New-Item -ItemType Directory -Force data
pnpm dev
```

在 `.env.local` 中至少设置 `SQLITE_PATH`，例如指向项目内未纳入版本控制的 `./data/content.sqlite`。应用会在首次访问时创建并迁移数据库。开发服务器默认位于 [http://localhost:3000](http://localhost:3000)。

## 运行时配置

不要提交 `.env.local` 或任何真实密钥。`.env.example` 只列出变量名，不包含凭据。

| 变量 | 要求 | 用途 |
| --- | --- | --- |
| `SQLITE_PATH` | 必填 | SQLite 数据文件路径；测试使用 `:memory:` 或独占临时文件。持久化文件的父目录必须已存在。 |
| `GITHUB_TOKEN` | 投稿与审核必填 | 仅授予审核仓库 Issues 所需权限的细粒度令牌。 |
| `GITHUB_OWNER` | 投稿与审核必填 | 私有审核仓库的所有者。 |
| `GITHUB_REPO` | 投稿与审核必填 | 私有审核仓库名。 |
| `GITHUB_WEBHOOK_SECRET` | 投稿与审核必填 | 验证 GitHub webhook HMAC 签名。 |
| `INTERNAL_APP_ORIGIN` | 校准任务必填 | 应用自身的绝对 origin，不包含路径、查询或凭据。 |
| `ALTCHA_HMAC_KEY` | 投稿必填 | 自托管 ALTCHA 挑战签名密钥。 |
| `ALTCHA_MAX_NUMBER` | 可选 | ALTCHA 难度上限，必须是正安全整数。 |
| `RATE_LIMIT_HMAC_KEY` | 投稿必填 | 匿名投稿限流标识的 HMAC 密钥。 |
| `GITHUB_API_BASE_URL` | 仅非生产环境可选 | 本地测试替代 GitHub API；生产环境会拒绝该变量。 |

完整投稿和审核流程需要配置表中对应的 GitHub、ALTCHA、限流与内部应用变量。运行校准任务：

```powershell
pnpm reconcile:github
```

## 验证

```powershell
node scripts/check-map-assets.mjs
pnpm lint
pnpm typecheck
pnpm test --run
pnpm exec playwright test
pnpm build
```

Playwright 配置会为每次运行创建独占的临时 SQLite 数据库并在结束后清理，不应指向共享或生产数据库。

## 字体策略

应用不使用 `next/font` 或远程字体。界面采用本地系统字体栈：正文优先 `system-ui`、`PingFang SC`、`Microsoft YaHei`、`sans-serif`；遥测信息优先 `ui-monospace`、`Cascadia Mono`、`SFMono-Regular`、`Consolas`、`monospace`。
