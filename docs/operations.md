# Knowledge Frontier 生产运维手册

本手册面向单台 California 主机上的 Docker Compose 部署。所有命令默认从 `/srv/knowledge-frontier/current` 执行。尖括号表示必须由操作者填写的非密钥标识，不可原样执行；密钥只通过批准的密钥管理器和 `sudoedit` 写入，不在终端、工单或日志中回显。

## 0. 强制审批边界

以下每一次操作都必须在执行当时取得明确人工批准，即使相同操作此前已获批：

- DNS 记录变更；
- 证书申请、签发或续期配置变更；
- 镜像推送；
- 服务启动、停止、重启、timer 启用或 daemon reload；
- 任何生产数据库变更，包括迁移、恢复文件发布和 `SQLITE_PATH` 切换；
- 流量切换，包括 `current` 链接切换和 DNS 切换；
- 创建、批准、关闭或更改 synthetic GitHub Issue 的标签。

每个审批记录应写明命令、目标主机/域名/仓库、镜像完整标签、预期影响、回滚点和批准人。诊断性的只读命令可以先执行。本文不会替操作者授予任何审批。

## 1. 变量和前置检查

在受控 shell 中设置非密钥标识：

```bash
export DOMAIN='<approved-domain>'
export RELEASE_TAG="$(git rev-parse --verify HEAD)"
export IMAGE_NAMESPACE='<registry>/<namespace>'
export APP_IMAGE="$IMAGE_NAMESPACE/knowledge-frontier-app:$RELEASE_TAG"
export MAINTENANCE_IMAGE="$IMAGE_NAMESPACE/knowledge-frontier-maintenance:$RELEASE_TAG"
export GITHUB_OWNER='<github-owner>'
export GITHUB_REPO='<private-review-repository>'
test -n "$DOMAIN" && test -n "$RELEASE_TAG"
git diff --quiet && git diff --cached --quiet
docker version
docker compose version
docker buildx version
```

预期：Git 提交 ID 非空、工作树无改动，Docker、Compose 和 Buildx 均返回版本信息。生产镜像标签必须是唯一提交 ID 或同等不可复用的版本，registry 必须启用 tag immutability；禁止使用 `latest`、`prod` 或其他可覆盖标签。

## 2. 首次部署

### 2.1 准备主机目录

审批门：以下命令会创建生产目录。确认目标主机和路径后再执行。

```bash
export DEPLOY_USER="$(id -un)"
export DEPLOY_GROUP="$(id -gn)"
sudo install -d -m 0755 /srv/knowledge-frontier
sudo install -d -o 1001 -g 1001 -m 0750 /srv/knowledge-frontier/data /srv/knowledge-frontier/backups
sudo install -d -m 0755 /etc/knowledge-frontier
sudo install -o "$DEPLOY_USER" -g "$DEPLOY_GROUP" -m 0600 /dev/null /etc/knowledge-frontier/app.env
sudo install -m 0644 /dev/null /etc/knowledge-frontier/compose.env
```

预期：`data`、`backups` 由镜像中的 UID/GID 1001 拥有；两个配置文件存在；`app.env` 由部署用户拥有且权限为 `0600`。

### 2.2 写入环境配置

使用 `sudoedit /etc/knowledge-frontier/app.env` 写入下列变量名。`SQLITE_PATH` 使用 `/data/` 下的文件，`BACKUP_DIR` 使用 `/backups`，`INTERNAL_APP_ORIGIN` 使用 Compose 内部 origin；其余值从批准的密钥管理器或生产登记中取得，不要粘贴到命令历史：

```text
SQLITE_PATH
GITHUB_TOKEN
GITHUB_OWNER
GITHUB_REPO
GITHUB_WEBHOOK_SECRET
ALTCHA_HMAC_KEY
ALTCHA_MAX_NUMBER
RATE_LIMIT_HMAC_KEY
PUBLIC_BASE_URL
BACKUP_DIR
INTERNAL_APP_ORIGIN
```

生产环境不得设置 `GITHUB_API_BASE_URL`。再用 `sudoedit /etc/knowledge-frontier/compose.env` 写入下列非密钥部署选择器，值必须是本次不可变镜像标签和批准的证书目录：

```text
APP_IMAGE
MAINTENANCE_IMAGE
APP_ENV_FILE
TLS_CERT_DIR
```

其中 `APP_ENV_FILE` 必须指向 `/etc/knowledge-frontier/app.env`。校验时只输出名称和权限，不输出值：

```bash
sudo chmod 0600 /etc/knowledge-frontier/app.env
sudo chmod 0644 /etc/knowledge-frontier/compose.env
sudo stat -c '%a %n' /etc/knowledge-frontier/app.env /etc/knowledge-frontier/compose.env
sudo awk -F= 'NF {print $1}' /etc/knowledge-frontier/app.env | sort
```

预期：权限依次为 `600`、`644`，变量名完整且没有 `GITHUB_API_BASE_URL`。

在发布目录就绪后，将 Compose 自动读取的 `.env` 指向非密钥选择器文件：

```bash
sudo ln -sfn /etc/knowledge-frontier/compose.env /srv/knowledge-frontier/current/.env
```

审批门：若 `current` 本身需要首次创建或切换到新发布目录，这属于流量切换；必须单独批准后再修改该链接。

### 2.3 配置 DNS 和 TLS

先只读确认主机公网地址和当前解析。审批门：在 DNS 控制台/API 中创建或修改记录前，必须确认域名、记录类型、目标地址、TTL 和回滚值并取得批准。

```bash
dig +short A "$DOMAIN"
dig +short AAAA "$DOMAIN"
```

预期：传播完成后只返回批准的地址；没有使用 IPv6 时 AAAA 结果为空。

审批门：证书签发会联系 CA 并写入证书状态。确认 DNS 已传播、80 端口可用于首次 standalone challenge、联系地址和续期责任后，才可执行已审核的 ACME 命令：

```bash
sudo certbot certonly --standalone --non-interactive --agree-tos --email '<approved-contact-address>' -d "$DOMAIN"
```

预期：客户端报告证书签发成功。签发后只读校验证书，不打印私钥：

```bash
openssl x509 -in "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" -noout -subject -issuer -dates
sudo test -r "/etc/letsencrypt/live/$DOMAIN/privkey.pem"
```

预期：subject 覆盖批准域名、issuer 正确且有效期合理；root 可以读取私钥。源 Certbot 私钥只需由主机 root 在校验和复制时读取，复制到专用目录后的私钥则需由 Nginx 容器主进程（root）读取。由于 ACME `live` 目录中的文件通常是指向 `archive` 的链接，不能只把 `live/$DOMAIN` bind mount 到容器。审批门：确认源证书和目标路径后，把实际文件复制到专用目录：

```bash
sudo install -d -m 0750 /etc/knowledge-frontier/tls
sudo install -m 0644 "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" /etc/knowledge-frontier/tls/fullchain.pem
sudo install -m 0600 "/etc/letsencrypt/live/$DOMAIN/privkey.pem" /etc/knowledge-frontier/tls/privkey.pem
```

`TLS_CERT_DIR` 必须指向 `/etc/knowledge-frontier/tls`。续期自动化必须原子更新这两个文件；让 Nginx 重新加载证书属于服务变更，仍需执行时批准。

### 2.4 构建并推送不可变 Linux 镜像

构建不会读取生产环境文件，也不能使用 secret build args：

```bash
docker buildx build --platform linux/amd64 --target app --tag "$APP_IMAGE" --load web
docker buildx build --platform linux/amd64 --target maintenance --tag "$MAINTENANCE_IMAGE" --load web
docker image inspect "$APP_IMAGE" --format '{{.Os}}/{{.Architecture}}'
docker image inspect "$MAINTENANCE_IMAGE" --format '{{.Os}}/{{.Architecture}}'
```

预期：两次检查均输出 `linux/amd64`。

审批门：以下命令会向 registry 推送镜像；逐个确认完整标签未存在或 registry 会拒绝覆盖后再执行。

```bash
docker push "$APP_IMAGE"
docker push "$MAINTENANCE_IMAGE"
docker buildx imagetools inspect "$APP_IMAGE"
docker buildx imagetools inspect "$MAINTENANCE_IMAGE"
```

预期：push 成功且两个镜像都有 registry digest。把标签与 digest 写入部署记录，不记录凭据。

### 2.5 渲染配置、备份和启动

先执行只读配置检查：

```bash
cd /srv/knowledge-frontier/current
docker compose config --quiet
docker compose config --images
```

预期：配置无错误，输出包含 `compose.env` 中的两个不可变版本标签以及 Nginx 镜像；不能出现空镜像名。

已有生产数据库时，首次启动新版本前必须创建部署前备份。审批门：确认 `SQLITE_PATH` 和备份目录后，批准下面的生产备份写入：

```bash
docker compose --profile maintenance run --rm --no-deps maintenance /opt/knowledge-frontier/scripts/backup-sqlite.sh
```

预期：命令只输出 `/backups/` 下新建 `.db` 的容器路径且退出 0。将对应主机文件 `/srv/knowledge-frontier/backups/<basename>` 记录为 `PRE_DEPLOY_BACKUP`。

审批门：拉取镜像及首次启动会改变生产服务状态；app 首次打开数据库还会创建或执行待应用 migration，属于生产数据库变更。确认备份、镜像 digest、Compose 渲染结果、migration 清单和回滚标签后再执行：

```bash
docker compose pull app maintenance nginx
docker compose up -d --no-build app nginx
docker compose ps
```

预期：`app` 变为 healthy，`nginx` 为 running，只有 Nginx 发布 80/443。

安装定时任务也需要服务变更审批：

```bash
sudo install -m 0644 deploy/systemd/knowledge-*.service deploy/systemd/knowledge-*.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now knowledge-reconcile.timer knowledge-backup.timer
systemctl list-timers 'knowledge-*'
```

预期：两个 timer 为 active，reconciliation 下一次运行不超过约十分钟，backup 下一次运行是本地时间 03:30。`daemon-reload` 和 `enable --now` 必须在同一审批中明确列出。

## 3. 部署后验证

### 3.1 健康、TLS 和页面

```bash
curl --fail --silent --show-error "https://$DOMAIN/api/health"
curl --fail --silent --show-error --output /dev/null --write-out 'status=%{http_code} ttfb=%{time_starttransfer}s total=%{time_total}s\n' "https://$DOMAIN/"
openssl s_client -connect "$DOMAIN:443" -servername "$DOMAIN" </dev/null 2>/dev/null | openssl x509 -noout -subject -issuer -dates
docker compose ps
```

预期：健康接口返回 `{"status":"ok"}`；首页状态为 200；证书覆盖域名且未过期；app healthy、Nginx running。

### 3.2 Synthetic 非敏感审核闭环

只使用明确标注为 synthetic 的虚构内容，不能包含个人资料、凭据、内部 URL 或真实面试信息。

审批门：在创建 synthetic GitHub Issue 前，记录目标私有仓库和清理责任并取得批准。批准后访问 `https://$DOMAIN/submit/fundamentals`，通过页面提交标题、分类、标签和正文均明确标注为 synthetic 的测试内容，记录返回的 Issue 编号：

```bash
export ISSUE_NUMBER='<synthetic-issue-number>'
gh issue view "$ISSUE_NUMBER" --repo "$GITHUB_OWNER/$GITHUB_REPO" --json number,state,labels,title
```

预期：Issue 具有 `submission`、`pending`、`region:fundamentals` 标签，且没有敏感内容。

审批门：添加 `approved` 是审核状态和生产发布变更，必须由授权审核人再次批准：

```bash
gh issue edit "$ISSUE_NUMBER" --repo "$GITHUB_OWNER/$GITHUB_REPO" --add-label approved
```

预期：webhook 或十分钟 reconciliation 后，Issue 具有 `published`、不再具有 `pending` 且已关闭。只读验证：

```bash
gh issue view "$ISSUE_NUMBER" --repo "$GITHUB_OWNER/$GITHUB_REPO" --json number,state,labels
curl --fail --silent --show-error --output /dev/null --write-out '%{http_code}\n' "https://$DOMAIN/content/gh-$ISSUE_NUMBER"
```

预期：Issue closed 且有 `published` 标签；内容 URL 返回 200。若需要手动启动 reconciliation，`sudo systemctl start knowledge-reconcile.service` 属于服务启动，必须另行审批。

审批门：验证完成后的 synthetic 清理会改变 GitHub Issue 和生产发布状态，必须再次批准：

```bash
gh issue edit "$ISSUE_NUMBER" --repo "$GITHUB_OWNER/$GITHUB_REPO" --add-label unpublish
test "$(curl --silent --output /dev/null --write-out '%{http_code}' "https://$DOMAIN/content/gh-$ISSUE_NUMBER")" = 404
```

预期：webhook 或 reconciliation 后内容 URL 返回 404；保留 Issue 作为带 synthetic 标记的审计记录。若组织策略要求删除 Issue，另行审批且不要把删除作为常规验证步骤。

### 3.3 中国大陆独立探测

California 单地域部署无法保证跨境链路的延迟、丢包或稳定性。发布后必须同时配置并保存以下两个彼此独立运营的平台结果，且每个平台选择至少两个实际位于中国大陆、不同运营商的探测点：

1. 阿里云云监控 SiteMonitor/站点监控；
2. 华为云云监控站点监控。

审批门：创建或修改外部探测任务前，确认不会提交密钥或个人数据，并取得对目标域名、探测区域、频率和费用的批准。两个平台都应对 `https://<approved-domain>/` 记录 DNS 解析结果、TLS 握手/证书状态、TTFB、HTTP 状态和页面内容断言，并对 `/api/health` 断言 200 与健康响应。预期：DNS 指向批准地址、TLS 有效、页面和健康接口可用。TTFB 只记录基线与分位数，不把 California-only 架构描述为具有跨境延迟保证；任一平台失败都暂停继续放量并进入事件响应。

## 4. 备份和非破坏恢复演练

审批门：手动 backup 会启动 maintenance 容器并写入生产备份目录；确认目标后再执行：

```bash
cd /srv/knowledge-frontier/current
docker compose --profile maintenance run --rm --no-deps maintenance /opt/knowledge-frontier/scripts/backup-sqlite.sh
export BACKUP_FILE='/srv/knowledge-frontier/backups/<recorded-backup-file>.db'
test -f "$BACKUP_FILE"
```

预期：生成新的、权限受限的 `.db` 文件，源数据库未被替换。

恢复验证必须在 maintenance 容器内由 `mktemp -d` 创建的临时目录进行，绝不指向 `/data`：

```bash
docker compose --profile maintenance run --rm --no-deps maintenance sh -ec '
  restore_dir="$(mktemp -d)"
  trap '\''rm -rf -- "$restore_dir"'\'' EXIT
  /opt/knowledge-frontier/scripts/verify-restore.sh "$1" "$restore_dir"
  test "$(sqlite3 "$restore_dir/restored.db" "PRAGMA integrity_check;")" = ok
  printf "restore verification: ok\n"
' sh "/backups/$(basename "$BACKUP_FILE")"
```

预期：输出临时 `restored.db` 路径和 `restore verification: ok`，退出时删除临时目录；生产 `SQLITE_PATH` 和现有数据文件均不变化。

## 5. 回滚到先前不可变镜像

先设置部署记录中的先前标签；不要使用当前可变别名：

```bash
export TARGET_APP_IMAGE='<registry>/<namespace>/knowledge-frontier-app:<prior-immutable-tag>'
export TARGET_MAINTENANCE_IMAGE='<registry>/<namespace>/knowledge-frontier-maintenance:<prior-immutable-tag>'
docker pull "$TARGET_APP_IMAGE"
docker pull "$TARGET_MAINTENANCE_IMAGE"
```

### 5.1 强制 schema 兼容检查

目标 maintenance 镜像包含它支持的迁移文件。下面只读比较其最高迁移版本与 live `schema_migrations`；任何不相等都按不兼容处理，除非另有经过评审的向后兼容证据：

```bash
TARGET_SCHEMA_VERSION="$(docker run --rm --entrypoint sh "$TARGET_MAINTENANCE_IMAGE" -ec '
  latest="$(find src/server/db/migrations -maxdepth 1 -type f -name "[0-9][0-9][0-9][0-9]-*.ts" -printf "%f\n" | sort | tail -n 1)"
  test -n "$latest"
  printf "%s\n" "$latest" | sed -E "s/^0*([0-9]+)-.*/\1/"
')"
LIVE_SCHEMA_VERSION="$(docker compose --profile maintenance run --rm --no-deps maintenance sh -ec '
  sqlite3 -readonly "$SQLITE_PATH" "SELECT COALESCE(MAX(version), 0) FROM schema_migrations;"
')"
printf 'target=%s live=%s\n' "$TARGET_SCHEMA_VERSION" "$LIVE_SCHEMA_VERSION"
```

预期：两个值均为整数。相等时可进入 5.2；不相等时必须先执行 5.3，不能直接启动旧镜像。

### 5.2 schema 相容时切换镜像

用 `sudoedit /etc/knowledge-frontier/compose.env` 将 `APP_IMAGE` 和 `MAINTENANCE_IMAGE` 改为上述先前不可变标签，然后先检查：

```bash
docker compose config --quiet
docker compose config --images
```

审批门：这是镜像和流量切换，并会重建/重启生产服务。确认目标标签、digest 和健康回滚条件后才执行：

```bash
docker compose up -d --no-build --force-recreate app nginx
curl --fail --silent --show-error "https://$DOMAIN/api/health"
```

预期：Compose 使用先前标签，app 恢复 healthy，健康接口返回 `{"status":"ok"}`。失败时停止继续变更并进入第 7 节。

### 5.3 schema 不相容时恢复到新文件

必须使用本次部署前记录的 `PRE_DEPLOY_BACKUP`，先按第 4 节在 `mktemp -d` 中验证。随后选择一个从未存在的新数据库文件名。

审批门：以下命令会从备份创建新的生产数据库文件，属于生产数据库写入；确认备份时间、integrity check 和新路径后才执行：

```bash
export PRE_DEPLOY_BACKUP='/srv/knowledge-frontier/backups/<pre-deploy-backup>.db'
export ROLLBACK_DB_BASENAME="content.rollback-$(date -u +%Y%m%dT%H%M%SZ).sqlite"
test ! -e "/srv/knowledge-frontier/data/$ROLLBACK_DB_BASENAME"
docker compose --profile maintenance run --rm --no-deps maintenance sh -ec '
  restore_dir="$(mktemp -d)"
  trap '\''rm -rf -- "$restore_dir"'\'' EXIT
  /opt/knowledge-frontier/scripts/verify-restore.sh "$1" "$restore_dir"
  install -m 0600 "$restore_dir/restored.db" "/data/$2"
  test "$(sqlite3 "/data/$2" "PRAGMA integrity_check;")" = ok
' sh "/backups/$(basename "$PRE_DEPLOY_BACKUP")" "$ROLLBACK_DB_BASENAME"
```

预期：新文件通过 integrity check，原 live 数据库仍存在且未被覆盖。

审批门：只有在新文件验证完成后，才可用 `sudoedit /etc/knowledge-frontier/app.env` 把 `SQLITE_PATH` 改为 `/data/$ROLLBACK_DB_BASENAME`；这是独立的生产数据库指针变更，必须再次批准。然后回到 5.2，经另一项服务/流量切换批准后重建服务。不得原地覆盖 live 数据库。

## 6. 密钥轮换

1. 确认轮换变量：`GITHUB_TOKEN`、`GITHUB_WEBHOOK_SECRET`、`ALTCHA_HMAC_KEY` 或 `RATE_LIMIT_HMAC_KEY`，并记录影响范围；不要读取或输出旧值。
2. 如变更可能影响写入，先按第 4 节取得经批准的备份。
3. 审批门：在 GitHub 或密钥管理器创建新凭据、更新 webhook secret、撤销旧凭据都是外部状态变更，必须分别批准。
4. 用 `sudoedit /etc/knowledge-frontier/app.env` 写入新值并重新执行权限与“仅变量名”检查。
5. 审批门：使新环境生效需要重建/重启 app，并可能短暂切换流量；批准后执行 `docker compose up -d --no-build --force-recreate app nginx`。
6. 执行健康检查和一轮经批准的 synthetic 审核闭环。确认新凭据工作后，才申请批准撤销旧凭据。

预期：健康检查为 200，审核闭环完成，日志不包含密钥。轮换 `ALTCHA_HMAC_KEY` 会使旧 challenge 失效；轮换 `RATE_LIMIT_HMAC_KEY` 会改变匿名限流标识，应在变更记录中说明。

## 7. 事件响应

1. 记录开始时间、症状、最近镜像标签/digest、最近 DB 迁移和变更审批；暂停后续发布。
2. 先执行只读诊断：

   ```bash
   docker compose ps
   docker compose logs --since 30m app nginx
   curl --silent --show-error --include "https://$DOMAIN/api/health"
   systemctl status knowledge-reconcile.service knowledge-backup.service --no-pager
   journalctl -u knowledge-reconcile.service -u knowledge-backup.service --since '-30 min' --no-pager
   ```

   预期：收集状态码、健康类别和时间边界；不要粘贴含投稿正文或凭据的日志到公共渠道。
3. 若疑似数据问题，停止会写入数据的进一步动作，记录 live schema 版本并按第 4 节验证最新已知良好备份。
4. 审批门：隔离流量、停止/重启服务、手动 reconciliation、DNS 切换、数据库恢复或 `SQLITE_PATH` 变更都必须分别说明影响和回滚方案并取得批准。
5. 镜像回滚严格执行第 5 节 schema 检查；不得因为告警压力跳过不相容恢复路径。
6. 恢复后重复健康、synthetic 审核闭环和两家中国大陆探测，并保存时间线。关闭事件前补充根因、数据影响、采取的动作和后续负责人。
