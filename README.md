# LastFE

> 前端开发者的圣地，耶路撒冷。

LastFE 是一个公开、免注册的求职知识库：以搜索优先的界面组织面经、学习资料、八股、项目与算法内容。所有公开内容无需登录即可浏览；匿名投稿经审核后发布。

线上地址：[https://lastfe-web.onrender.com/](https://lastfe-web.onrender.com/)

## 目录

- [功能](#功能)
- [使用](#使用)
  - [浏览内容](#浏览内容)
  - [投稿](#投稿)
- [文档入口](#文档入口)
- [技术栈](#技术栈)
- [后续开发计划](#后续开发计划)
- [参与贡献](#参与贡献)
- [本地开发](#本地开发)
- [配置变量](#配置变量)

## 功能

- **搜索优先**：首屏直达搜索，按关键词检索全站内容。
- **五大内容板块**：
  - **面经记录**：公司与岗位实战记录，标记真实面试路径。
  - **学习资料**：经过整理的课程、路线与外部学习入口。
  - **八股盛宴**：把零散知识组织成可检索的基础内容。
  - **项目推荐**：拆解能讲清取舍与结果的项目实践。
  - **算法手撕**：按来源和难度组织训练路线与题解。
- **免注册浏览**：所有公开内容无需登录即可访问。
- **匿名投稿**：无需账号即可投稿，经人工审核后公开发布。
- **双主题**：全站支持浅色、深色主题。
- **多维筛选**：按标签、分类、来源、难度等维度过滤内容。

## 使用

### 浏览内容

1. 打开首页，使用顶部搜索框检索关键词，或查看内容统计与最新内容。
2. 在「内容分类」中选择任一板块，按标签、来源、难度等条件筛选。
3. 点击内容卡片查看详情。

### 投稿

1. 访问 `/submit`，选择要投稿的内容分类。
2. 按表单填写标题、标签与正文（支持 Markdown）。
3. 提交后进入审核流程，审核通过即公开发布。

## 文档入口

- [产品与交互设计](docs/superpowers/specs/2026-09-01-interview-resource-sharing-design.md)
- [计划 1：内容与审核](docs/superpowers/plans/2026-09-01-content-moderation-platform.md)
- [计划 2：生产部署](docs/superpowers/plans/2026-09-01-production-deployment.md)
- [生产运维手册](docs/operations.md)

## 技术栈

- [Next.js](https://nextjs.org/) 16（App Router）+ React 19
- [Tailwind CSS](https://tailwindcss.com/) 4
- [Supabase](https://supabase.com/) PostgreSQL（公开内容存储）
- GitHub Issues（匿名投稿审核流程）
- Vitest / Playwright（单元测试与端到端测试）

## 后续开发计划

以下能力不提前加入，只在出现明确需求或瓶颈后评估：

- 链接失效举报或自动巡检：外部资料链接目前不做自动探测。
- 更强的防滥用策略：垃圾投稿增多后提高验证难度、调整限流或增加封禁规则。
- 管理后台：审核者增加且 GitHub 标签不足以表达权限后引入。
- 搜索增强：普通查询出现可测量的性能问题后引入全文检索。
- 部署优化：中国大陆跨境访问持续不达标后迁移至香港或其他邻近节点。

## 参与贡献

欢迎通过产品内的投稿入口贡献内容：[提交投稿](https://lastfe-web.onrender.com/submit)。

代码贡献流程：

1. Fork 仓库并从 `main` 创建分支。
2. 本地完成开发，运行 `pnpm lint`、`pnpm typecheck`、`pnpm test --run` 和 `pnpm exec playwright test`。
3. 提交 Pull Request，说明改动内容与验证方式。

项目基于 [MIT License](LICENSE) 开源。站点内容（面经、题解、资料摘要等）归原作者所有，引用时请注明来源。

## 本地开发

需要 Node.js 24.14.1 或兼容的 24.x 版本，并使用仓库声明的 `pnpm@11.19.0`。

```powershell
Set-Location web
pnpm install --frozen-lockfile
Copy-Item .env.example .env.local
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

线上使用 `CONTENT_REPOSITORY=supabase`，并配置 `SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY`、`GITHUB_TOKEN`、`GITHUB_REPOSITORY`、`GITHUB_WEBHOOK_SECRET` 和 `RATE_LIMIT_HMAC_KEY`。`GITHUB_API_BASE_URL` 仅用于非生产环境的 fake GitHub API。Render + Supabase 的部署步骤见 [Render + Supabase 部署说明](docs/deployment/render-supabase.md)。

Compose 部署选择器为 `APP_IMAGE`、`MAINTENANCE_IMAGE`、`APP_ENV_FILE` 和 `TLS_CERT_DIR`。不要提交 `.env.local`、生产环境文件或任何凭据；生产配置与逐步审批流程见[生产运维手册](docs/operations.md)。
