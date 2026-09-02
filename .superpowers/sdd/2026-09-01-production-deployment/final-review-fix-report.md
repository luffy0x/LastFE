# Plan 3 final-review fix report

日期：2026-09-02

审查基线：`ca1580e`

实现分支：`codex/knowledge-frontier`

## 结论

最终审查列出的 1 个 Critical、5 个 Important、破坏性边界测试阻塞项和 Node 版本说明均已在本地修复。变更保持在既定范围内，没有执行 push、merge、workflow dispatch、镜像发布、部署、服务重启、生产数据库/DNS/TLS/GitHub Issue 变更或系统运行时安装。

本地可执行的应用门禁和静态基础设施检查均通过。Docker、Linux 原生 `sqlite3`、systemd、ShellCheck 和 actionlint 在当前 Windows 主机不可用，因此不能据此声明容器或 Linux 运行时已验证。合并前仍必须由托管的 Linux/Docker CI 完整通过。

## 根因与修复

### 1. Reconciliation 初始化错误泄露

- 根因：配置读取和 SQLite 打开位于 `try` 之外，初始化异常走 Node 未处理拒绝路径，绕过结构化日志和脱敏边界。
- 修复：把配置、数据库打开和迁移移入受保护区；数据库句柄改为可选并安全关闭；真实 CLI 回归测试覆盖缺失配置和 SQLite 打开失败，断言只有 request ID 与错误类别，不出现原始错误或路径。
- 提交：`0307936 fix(reconcile): redact initialization failures`。

### 2. Maintenance 非重叠保证不完整

- 根因：锁和超时散落在 systemd unit 中，人工维护可绕过；仅终止 Compose 客户端不能保证 Docker daemon 管理的容器已退出。
- 修复：新增唯一入口 `deploy/scripts/run-maintenance.sh`，统一 17 分钟锁等待、15 分钟执行上限、30 秒 kill grace、固定容器名、陈旧容器拒绝、强制清理和清理后确认；systemd 与全部人工维护命令均改用该入口，并清除继承的镜像选择器。
- 提交：`8f2526c fix(ops): serialize maintenance execution`。

### 3. 备份/恢复破坏性边界

- 根因：词法目标路径与解析后的路径没有比较，目标目录的直接或尾随斜杠 symlink 可穿透既有目录边界；回滚文档还使用检查后覆盖的发布方式。
- 修复：备份和恢复脚本使用 `realpath -ms` 与解析路径对比，拒绝包含 symlink 的目标；测试覆盖根目录、非 `.db`、非普通文件、直接/尾随 symlink 和唯一 rollback 目录；回滚改为在 `/data/knowledge-frontier-rollback.XXXXXXXX/restored.db` 中由加固脚本无覆盖发布。
- 提交：`8f2526c fix(ops): serialize maintenance execution`、`fc00f5a docs(ops): harden deployment and rollback`。

### 4. Compose 镜像选择器与回滚原子性

- 根因：构建变量复用了 `APP_IMAGE`/`MAINTENANCE_IMAGE`，shell 环境优先级可覆盖更新后的 `compose.env`；原校验器的早期实现把两个镜像排序后比较，无法识别 app/maintenance 对调，也未拒绝重复目标。
- 修复：构建使用独立的 `BUILD_APP_IMAGE`/`BUILD_MAINTENANCE_IMAGE`；校验器显式移除继承选择器、分别解析 app 与 maintenance、逐服务精确匹配并拒绝重复目标；回滚先验证同目录暂存文件，经独立批准后 `mv -T` 原子激活，再次校验后才允许重启。密钥轮换的 mutating Compose 命令也显式清除选择器并指定 env file。
- 提交：`7e3764c ci: exercise deployment image runtimes`、`fc00f5a docs(ops): harden deployment and rollback`。

### 5. 镜像/运行时 CI 门禁不足

- 根因：旧 workflow 只构建镜像，没有执行 Dockerfile 结构检查、镜像配置/历史检查、maintenance 默认入口、app healthcheck 或精确 Compose 选择器检查。
- 修复：CI 现在构建两个 `linux/amd64` target，检查非 root 用户和敏感变量名是否进入 image config/history，运行 maintenance 运行时与默认 CLI 冒烟，启动 app 并执行镜像内 healthcheck，运行 Compose 选择器回归测试，并为 `systemd-analyze verify` 在临时 runner 上映射 unit 声明的 `/srv/knowledge-frontier/current` 路径。
- 提交：`7e3764c ci: exercise deployment image runtimes`。

### 6. 发布源码与不可变标签不一致

- 根因：原流程只检查 tracked diff，Docker 构建目录仍可包含 untracked/ignored 内容；首次部署也没有创建版本目录和 `current` 链接的完整步骤。
- 修复：从批准的完整 40 位 SHA 创建 detached worktree；在构建前同时拒绝普通和 ignored 状态输出；镜像检查和部署前备份通过后才以同文件系统候选链接原子切换 `current`。
- 提交：`fc00f5a docs(ops): harden deployment and rollback`。

### 7. Node 支持说明

- 根因：README 声明 Node 20.9+，但已安装的 `better-sqlite3@13.0.3` 元数据声明 `node >=22`。
- 修复：README 改为 Node 22+；本地读取包元数据得到 `{"version":"13.0.3","engines":{"node":">=22"}`。
- 提交：`fc00f5a docs(ops): harden deployment and rollback`。

## RED/GREEN 证据

### Reconciliation CLI

- RED：`pnpm test --run src/test/reconcile-github-cli.test.ts` 在实现前为 1 passed / 2 failed；两个初始化失败用例没有得到结构化失败日志。
- GREEN：同一命令在修复后为 3 passed / 0 failed；本轮复验仍为 3 passed。

### Maintenance 与恢复边界

- RED：新增直接/尾随目标 symlink、缺失统一 runner、systemd 未接入 runner、继承 stale selector 等行为用例后，旧实现分别在对应边界失败。
- GREEN：在临时 SQLite 兼容夹具下，备份/恢复边界用例通过；`bash deploy/scripts/test-maintenance-runner.sh` 本轮通过，覆盖锁、超时参数、固定容器名、stale 拒绝、强制清理、清理失败和选择器清除。
- 夹具已删除。正式的 `bash deploy/scripts/test-backup.sh` 本轮因缺少原生 `sqlite3` 按设计输出 `NOT RUN` 并退出 `77`，不能替代 Linux CI 结果。

### Compose 选择器

- RED 1：加入 app/maintenance 对调用例后，旧的集合排序比较仍输出成功，测试以 `FAIL: swapped app and maintenance image targets must be rejected` 退出 1。
- GREEN 1：改为逐服务解析和比较后，同一测试通过。
- RED 2：加入重复目标用例后，校验器仍接受相同 app/maintenance tag，测试以 `FAIL: duplicate app and maintenance image targets must be rejected` 退出 1。
- GREEN 2：加入 distinct-target 前置校验后，`bash deploy/scripts/test-compose-images.sh` 通过。

### 人工运维命令

- 文档为 human-facing prose，没有添加源文本测试。
- 31 个 `bash` fence 全部经 Git Bash `bash -n` 解析通过。
- 临时 detached worktree 在当前完整 SHA 上同时得到空的普通状态和 ignored 状态，随后由 `git worktree remove` 正常移除。

## 本地验证结果

### 完整应用门禁

使用仓库声明的 `pnpm@11.19.0`，按要求顺序执行：

| 命令 | 结果 |
| --- | --- |
| `pnpm lint` | 通过，exit 0 |
| `pnpm typecheck` | 通过，exit 0 |
| `pnpm test --run` | 44 files / 314 tests passed |
| `pnpm exec playwright test` | 26 passed |
| 删除 `web/.next-e2e` | 精确路径与非 reparse directory 已确认，仅该目录被删除 |
| `pnpm build` | Next.js 16.3.3 production build 通过 |

### 可用的基础设施/静态门禁

| 检查 | 结果 |
| --- | --- |
| 所有变更 shell 脚本 `bash -n` | 通过 |
| `bash deploy/scripts/test-compose-images.sh` | 通过 |
| `bash deploy/scripts/test-maintenance-runner.sh` | 通过 |
| `node web/Dockerfile.test.mjs` | 通过 |
| `pwsh -File deploy/nginx/test-config.ps1 -SkipDocker` | 静态 Nginx/Compose 断言通过 |
| CI YAML 解析 | 通过 |
| CI 中 20 个 Bash `run` block 的语法解析 | 通过 |
| operations 文档中 31 个 Bash fence 的语法解析 | 通过 |
| detached release worktree 源码检查 | 普通与 ignored 状态均为空 |
| `git diff ca1580e --check` | 通过 |

## 未执行且合并前必须补齐的门禁

当前主机没有 Docker/Compose/Buildx、原生 `sqlite3`、`systemd-analyze`、ShellCheck 或 actionlint；`wsl --list --quiet` 退出 1，未安装 Linux distribution。按照任务约束没有安装这些运行时，也没有 push 或 dispatch workflow。

因此以下检查仅被编码到 CI，未在本地执行：

- 两个 `linux/amd64` image target 的真实构建；
- image config/history 的真实敏感键检查；
- maintenance image 用户、pnpm、SQLite 和默认 CLI 冒烟；
- app container 启动和镜像内 `healthcheck.mjs`；
- 真实 Docker Compose 解析及 app/maintenance tag 选择；
- 容器内 `nginx -t`；
- 原生 Linux SQLite backup/restore round trip；
- `systemd-analyze verify`。

托管 GitHub Actions 的 `application` 与 `infrastructure` jobs 必须全部绿色后才能合并；本报告不构成容器、Linux 运行时或部署批准。

## 可变镜像标签评估

`web/Dockerfile` 的 `node:24-bookworm-slim` 和 `compose.yaml` 的 `nginx:alpine` 仍是可变标签。风险是相同源码在未来重建时可能获得不同的 Node/OS/Nginx 内容，且 `docker compose pull nginx` 可能让回滚同时引入未审查的 Nginx 更新。

本轮没有 Docker/Buildx，无法解析并验证准确的 `linux/amd64` digest，也无法对 pin 后镜像执行构建、启动和健康检查；因此没有猜测或写入 digest。后续应在 Docker-capable 环境解析并记录经审核的多架构/平台 digest，完成两 target 与 Nginx 运行时验证，再以明确的安全更新节奏更新 pin。

## Commit 清单

- `0307936 fix(reconcile): redact initialization failures`
- `8f2526c fix(ops): serialize maintenance execution`
- `7e3764c ci: exercise deployment image runtimes`
- `fc00f5a docs(ops): harden deployment and rollback`

报告文件本身将作为独立的本地文档提交，不在此自指其 commit hash。

## Review sign-off

- files changed before report: 14 (`+729/-128` against `ca1580e`)
- scope: on target
- review depth: deep
- hard stops: 0 remaining locally; selector service-mapping, duplicate-target validation, CI systemd path, and key-rotation selector handling were additionally found and fixed during final pass
- specialists: security and architecture passes performed sequentially; adversarial pass covered selector precedence, symlink/path races, process/container lifetime, atomic activation, and failure cleanup
- new tests: real reconciliation CLI cases plus maintenance, destructive-boundary, and Compose selector behavior harnesses
- doc debt: none for this fix wave; stable deployment invariants are in `docs/operations.md`
- merge status: blocked pending green hosted Linux/Docker CI
