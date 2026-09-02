# Knowledge Frontier

Knowledge Frontier 是一个以科幻战略地图呈现求职知识的 Next.js 应用。公开内容存储在 SQLite，匿名投稿进入私有 GitHub Issues 审核流程。

## 文档入口

- [产品与交互设计](docs/superpowers/specs/2026-09-01-interview-resource-sharing-design.md)
- [计划 1：地图体验](docs/superpowers/plans/2026-09-01-career-map-experience.md)
- [计划 2：内容与审核](docs/superpowers/plans/2026-09-01-content-moderation-platform.md)
- [计划 3：生产部署](docs/superpowers/plans/2026-09-01-production-deployment.md)
- [生产运维手册](docs/operations.md)

## 本地开发

需要 Node.js 22 或更高版本，并使用仓库声明的 `pnpm@11.19.0`。

```powershell
Set-Location web
pnpm install --frozen-lockfile
Copy-Item .env.example .env.local
New-Item -ItemType Directory -Force data
pnpm dev
```

本地验证：

```powershell
Set-Location web
pnpm lint
pnpm typecheck
pnpm test --run
pnpm exec playwright test
Remove-Item -LiteralPath .next-e2e -Recurse -Force -ErrorAction SilentlyContinue
pnpm build
```

## 配置变量

运行时变量名为 `SQLITE_PATH`、`GITHUB_TOKEN`、`GITHUB_OWNER`、`GITHUB_REPO`、`GITHUB_WEBHOOK_SECRET`、`ALTCHA_HMAC_KEY`、`ALTCHA_MAX_NUMBER`、`RATE_LIMIT_HMAC_KEY`、`PUBLIC_BASE_URL`、`BACKUP_DIR` 和 `INTERNAL_APP_ORIGIN`。`GITHUB_API_BASE_URL` 仅用于非生产环境。

Compose 部署选择器为 `APP_IMAGE`、`MAINTENANCE_IMAGE`、`APP_ENV_FILE` 和 `TLS_CERT_DIR`。不要提交 `.env.local`、生产环境文件或任何凭据；生产配置与逐步审批流程见[生产运维手册](docs/operations.md)。
