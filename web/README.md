# Knowledge Frontier

Knowledge Frontier 是一个面向求职知识分享的 Next.js 应用。首页提供可拖拽、缩放和键盘操作的 SVG 战略地图，领地页面从 Supabase PostgreSQL 读取已发布内容，匿名投稿通过 GitHub Issues 进入审核流程。

## 本地运行

需要 Node.js 24.14.1 或兼容的 24.x 版本，以及仓库声明的 pnpm 版本。

```powershell
pnpm install --frozen-lockfile
Copy-Item .env.example .env.local
pnpm dev
```

本地默认使用 fixture 内容源；要连接 Supabase，请在 `.env.local` 中设置 `CONTENT_REPOSITORY=supabase`、`SUPABASE_URL` 和 `SUPABASE_SERVICE_ROLE_KEY`。开发服务器默认位于 [http://localhost:3000](http://localhost:3000)。

## 运行时配置

不要提交 `.env.local` 或任何真实密钥。`.env.example` 只列出变量名，不包含凭据。

| 变量 | 要求 | 用途 |
| --- | --- | --- |
| `CONTENT_REPOSITORY` | 生产必填 | 线上设置为 `supabase`；本地为空时使用 fixture。 |
| `SUPABASE_URL` | Supabase 必填 | Supabase 项目 URL。 |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase 必填 | 服务端 Supabase service role key，不能暴露到浏览器。 |
| `GITHUB_TOKEN` | 投稿与审核必填 | 仅授予审核仓库 Issues 所需权限的细粒度令牌。 |
| `GITHUB_REPOSITORY` | 投稿与审核必填 | 私有审核仓库，格式为 `owner/repo`。 |
| `GITHUB_WEBHOOK_SECRET` | 投稿与审核必填 | 验证 GitHub webhook HMAC 签名。 |
| `RATE_LIMIT_HMAC_KEY` | 投稿必填 | 匿名化来源标识，用于 Supabase 去重和限流。 |
| `GITHUB_API_BASE_URL` | 仅非生产环境可选 | 本地测试替代 GitHub API；生产环境会拒绝该变量。 |

完整投稿和审核流程需要配置表中对应的 Supabase 与 GitHub 变量。运行校准任务：

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

Playwright 配置会为每次运行创建独占的临时目录，并使用 fixture 内容源与 fake GitHub API，不会连接共享或生产 Supabase 数据库。

## 字体策略

应用不使用 `next/font` 或远程字体。界面采用本地系统字体栈：正文优先 `system-ui`、`PingFang SC`、`Microsoft YaHei`、`sans-serif`；遥测信息优先 `ui-monospace`、`Cascadia Mono`、`SFMono-Regular`、`Consolas`、`monospace`。
