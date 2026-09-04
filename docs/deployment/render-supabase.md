# Render + Supabase 部署说明

本项目线上数据源使用 Supabase PostgreSQL，不再使用 SQLite。源码中只提交迁移、环境变量名和部署清单，真实密钥只配置在 Render/Supabase/GitHub 的控制台。

## Supabase

1. 新建 Supabase 项目。
2. 在 Supabase SQL editor 中执行 `web/supabase/migrations/001_initial_schema.sql`。
3. 在 Project Settings / API 记录：
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`

`SUPABASE_SERVICE_ROLE_KEY` 只能放在服务端环境变量里，不能暴露给浏览器。

## GitHub 审核仓库

1. 准备一个私有仓库作为投稿审核队列。
2. 创建 fine-grained token，只授予该仓库 Issues 读写权限。
3. 配置 webhook 指向 `https://<your-domain>/api/github/webhook`，事件选择 Issues。
4. 生成并保存 `GITHUB_WEBHOOK_SECRET`。

## Render

仓库根目录的 `render.yaml` 定义了两个服务：

- `lastfe-web`：Next.js Web 服务，健康检查为 `/api/health`。
- `lastfe-github-reconcile`：每 10 分钟扫描一次私有 Issues，补偿 webhook 丢失。

在 Render 里配置这些环境变量：

- `CONTENT_REPOSITORY=supabase`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GITHUB_TOKEN`
- `GITHUB_REPOSITORY`
- `GITHUB_WEBHOOK_SECRET`
- `RATE_LIMIT_HMAC_KEY`

## 发布与回滚

发布前在本地运行：

```bash
cd web
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Render 通过 Git commit 部署。需要回滚时，在 Render dashboard 选择上一条成功部署记录重新部署；数据库 schema 只做向前兼容迁移，不在自动发布过程中删除表或字段。
