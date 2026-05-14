# 生产部署 (CI/CD via GitHub Actions)

本项目通过 GitHub Actions 实现 push 到 `main` 自动部署到生产服务器:

- 触发: push `main` 或手动 `workflow_dispatch`
- 流程: **Lint/TypeCheck 闸 → SSH 到服务器 → git pull → docker compose build & up → 健康检查**
- 服务器: 单台 Linux VPS,Docker 化部署
- 数据库: 由 `docker-compose.yml` 内置 pgvector 服务托管

> 关键文件:
> - [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml) — Actions 编排
> - [`docker-compose.production.yml`](../docker-compose.production.yml) — 生产环境 compose 覆盖
> - [`scripts/server-bootstrap.sh`](../scripts/server-bootstrap.sh) — 服务器首次初始化

---

## 1. 一次性初始化(只在第一次部署前做)

### 1.1 准备一对 SSH 密钥(本机生成,只用于 GitHub Actions)

```bash
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/pharma_alpha_deploy -N ""
# 输出:
#   ~/.ssh/pharma_alpha_deploy        ← 私钥,稍后给 GitHub Secret
#   ~/.ssh/pharma_alpha_deploy.pub    ← 公钥,稍后放服务器
```

### 1.2 在服务器上跑一次 bootstrap

把 `scripts/server-bootstrap.sh` 上传到服务器并执行(只跑一次,后续靠 Actions):

```bash
scp scripts/server-bootstrap.sh root@<SERVER_IP>:/tmp/
ssh root@<SERVER_IP>
sudo bash /tmp/server-bootstrap.sh \
  --repo  https://github.com/<your-org>/PharmaAlpha.git \
  --path  /opt/pharma-alpha \
  --user  deploy
```

脚本会:
1. 装 Docker(如果没装)
2. 创建 `deploy` 用户并加入 `docker` 组
3. 给 deploy 用户准备 `~/.ssh/authorized_keys`
4. clone 仓库到 `/opt/pharma-alpha`
5. 生成 `.env.production` 模板(如果还没有)

### 1.3 把公钥放到服务器

```bash
# 在服务器上:
echo "<把 ~/.ssh/pharma_alpha_deploy.pub 的内容贴这里>" >> /home/deploy/.ssh/authorized_keys
```

### 1.4 编辑 `.env.production` 填生产秘密

```bash
ssh deploy@<SERVER_IP>
vim /opt/pharma-alpha/.env.production
```

必填项:

```ini
NEXTAUTH_SECRET=          # openssl rand -base64 32
LLM_API_KEY=              # 大模型 API key
LLM_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
LLM_MODEL=qwen-plus
DASHSCOPE_API_KEY=
EMBEDDING_PROVIDER=dashscope
EMBEDDING_API_KEY=
EMBEDDING_MODEL=text-embedding-v4
EMBEDDING_DIMENSIONS=1024
POSTGRES_PASSWORD=        # 数据库密码,自己定一个强密码
```

> ⚠ 这个文件 **永远不要进 git**,`.gitignore` 已经排除 `.env*`。

### 1.5 在 GitHub 配置 Secrets

仓库 → **Settings → Secrets and variables → Actions → Secrets**:

| Secret | 值 |
|---|---|
| `SSH_HOST` | 服务器公网 IP 或域名 |
| `SSH_USER` | `deploy` |
| `SSH_PORT` | `22`(或你自定义的端口) |
| `SSH_PRIVATE_KEY` | `~/.ssh/pharma_alpha_deploy` 文件**完整内容**(含 `-----BEGIN/END` 行) |
| `DEPLOY_PATH` | `/opt/pharma-alpha` |

仓库 → **Settings → Secrets and variables → Actions → Variables**(可选):

| Variable | 值 | 用途 |
|---|---|---|
| `HEALTH_URL` | `http://<域名或IP>:3000/` | 部署后健康检查;不填则跳过 |

### 1.6 配置 GitHub Environment(强烈推荐)

仓库 → **Settings → Environments → New environment → `production`**

可选启用:
- **Required reviewers**: 部署前需要人工审批(适合还在试运行阶段)
- **Wait timer**: 部署延迟 N 分钟(给紧急回滚留窗口)
- **Deployment branches**: 限定只允许 `main` 触发

### 1.7 第一次手动启动(可选,用于验证环境)

```bash
ssh deploy@<SERVER_IP>
cd /opt/pharma-alpha
docker compose -f docker-compose.yml -f docker-compose.production.yml up -d --build
docker compose ps
```

确认两个容器都健康后,后续 push `main` 就会自动部署。

---

## 2. 日常使用

### 2.1 自动部署

```bash
git push origin main
# 然后到 GitHub → Actions 标签页看进度
```

阶段:
1. **Lint & Type Check**(失败则不部署)
2. **SSH Deploy**: 服务器上 `git pull` + `docker compose up -d --build`
3. **Health check**: 如果配了 `HEALTH_URL`,会探测 30 次(150 秒窗口)

### 2.2 手动触发(无需 push)

仓库 → **Actions → Deploy to Production → Run workflow**

可勾选 "Skip lint checks (emergency hotfix)"——但只在紧急回滚时用。

### 2.3 跳过部署但要 push

commit message 加 `[skip ci]` 或 `[ci skip]`:

```bash
git commit -m "docs: typo fix [skip ci]"
```

### 2.4 回滚

服务器上手动操作:

```bash
ssh deploy@<SERVER_IP>
cd /opt/pharma-alpha
git log --oneline -10                     # 找到要回滚的 commit
git reset --hard <commit-sha>
docker compose -f docker-compose.yml -f docker-compose.production.yml up -d --build
```

> 进阶选项: 切到镜像推方案(GHCR/ACR)后,可以直接 `docker compose pull` 拉旧 tag,无需源码回滚。

---

## 3. 运维清单

### 3.1 看日志

```bash
docker compose -f docker-compose.yml -f docker-compose.production.yml logs -f app
docker compose -f docker-compose.yml -f docker-compose.production.yml logs -f db
```

或者直接看应用 agent 日志(已通过 volume 挂在宿主机):

```bash
ls /opt/pharma-alpha/agents/logs/
```

### 3.2 备份数据库

强烈建议加到 cron:

```bash
# /etc/cron.daily/pharma-pg-backup
#!/bin/bash
set -e
BACKUP_DIR=/var/backups/pharma-pg
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p "$BACKUP_DIR"
docker exec pharma-pg pg_dump -U postgres pharma_alpha | gzip > "$BACKUP_DIR/pharma_alpha_$DATE.sql.gz"
# 保留最近 14 天
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +14 -delete
```

### 3.3 升级 Docker 镜像

```bash
docker compose -f docker-compose.yml -f docker-compose.production.yml pull
docker compose -f docker-compose.yml -f docker-compose.production.yml up -d --build
docker image prune -f
```

### 3.4 改了环境变量后

只重启 app 容器即可,不需要重 build:

```bash
docker compose -f docker-compose.yml -f docker-compose.production.yml up -d --no-build app
```

---

## 4. Schema 迁移行为

`scripts/docker-entrypoint.sh` 启动时按下面的策略处理 schema:

| 数据库当前状态 | entrypoint 行为 |
|---|---|
| 全空(无任何业务表) | `prisma migrate deploy` 从头 apply 所有 migration |
| 已有 `_prisma_migrations` 表(按 migrate 管理过) | `prisma migrate deploy` 增量 apply 待用 migration |
| 有业务表但无 `_prisma_migrations` 表(早期 `db push` 留下的) | **拒绝启动**,提示运维做 baseline |

如果你撞到第三种情况(常见于早期开发库迁到生产),处理一次性 baseline:

```bash
ssh deploy@<SERVER>
cd /opt/pharma-alpha
docker compose -f docker-compose.yml -f docker-compose.production.yml run --rm --entrypoint sh app -c '
  for m in prisma/migrations/2026*; do
    npx prisma migrate resolve --applied "$(basename "$m")"
  done
'
```

之后 entrypoint 会自动转入第二种状态,后续 `git push main` → `migrate deploy` 一路通。

> 本地 throwaway 开发库如果想保留旧的 `db push` 行为,在 compose 里加 `PRISMA_ALLOW_DB_PUSH=true`。**生产环境永远不要打开这个开关**——它带 `--accept-data-loss`,会直接丢字段。

---

## 5. 国内网络优化(可选)

如果 GitHub Actions 一侧 SSH 进服务器后 `git pull` 慢/超时:

- 在服务器配代理:
  ```bash
  git config --global url."https://gh-proxy.com/https://github.com/".insteadOf "https://github.com/"
  ```
- 或者切到**镜像推路径**(B 方案):Actions build 镜像 push 到阿里云 ACR / 腾讯 TCR,服务器只 `docker compose pull`,完全不碰 GitHub。需要时告诉我,我可以基于现有 workflow 改一版镜像推 + 回滚 tag 的版本。
